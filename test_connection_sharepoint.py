"""Offline tests: python -m unittest discover -s App/panel_mantenimiento -p test_connection_sharepoint.py"""

import unittest
import sys
from types import SimpleNamespace
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

from connection_sharepoint import (
    BIGNUMERIC_MAX, BIGNUMERIC_MIN, NUMERIC_MAX, ColumnSchema, ExtractionRequest,
    SharePointSettings, SharePointClient, ConnectionSharePointError, create_client_context,
    convert_value, extract_records, prompt_extraction_request,
)


class ConversionTests(unittest.TestCase):
    def test_int64_boundaries_and_fraction(self):
        column = ColumnSchema("Id", "INTEGER")
        for value in (-(2**63), 2**63 - 1):
            self.assertEqual(convert_value(str(value), column), value)
        for value in (str(2**63), str(-(2**63) - 1), "1.1"):
            with self.assertRaises(ValueError):
                convert_value(value, column)

    def test_exact_decimal_boundaries(self):
        for kind, values in (("NUMERIC", (NUMERIC_MAX, NUMERIC_MAX.copy_negate())),
                             ("BIGNUMERIC", (BIGNUMERIC_MIN, BIGNUMERIC_MAX))):
            for value in values:
                self.assertEqual(convert_value(str(value), ColumnSchema("Cost", kind)), value)
        for kind, value in (("NUMERIC", "1e29"), ("NUMERIC", "0.0000000001"),
                            ("BIGNUMERIC", "1e39"), ("BIGNUMERIC", "1e-39")):
            with self.assertRaises(ValueError):
                convert_value(value, ColumnSchema("Cost", kind))

    def test_decimal_separators_and_trailing_zeroes(self):
        column = ColumnSchema("Cost", "NUMERIC", decimal_separator=",", thousands_separator=".")
        self.assertEqual(convert_value("1.234,56", column), Decimal("1234.56"))
        self.assertEqual(convert_value(1234.56, column), Decimal("1234.56"))
        self.assertEqual(convert_value("1.0000000000", ColumnSchema("Cost", "NUMERIC")), Decimal(1))

    def test_nullability_and_boolean(self):
        self.assertIsNone(convert_value("", ColumnSchema("Id", "INT64")))
        with self.assertRaises(ValueError):
            convert_value(None, ColumnSchema("Id", "INT64", nullable=False))
        self.assertFalse(convert_value("no", ColumnSchema("Active", "BOOL")))
        self.assertTrue(convert_value(1.0, ColumnSchema("Active", "BOOL")))
        with self.assertRaises(ValueError):
            convert_value("maybe", ColumnSchema("Active", "BOOL"))

    def test_timestamp_timezone(self):
        column = ColumnSchema("Event", "TIMESTAMP")
        actual = convert_value("2026-09-24 10:30:00-0300", column)
        self.assertEqual(actual, datetime(2026, 9, 24, 13, 30, tzinfo=timezone.utc))
        with self.assertRaises(ValueError):
            convert_value(datetime(2026, 9, 24), column)
        with self.assertRaises(ValueError):
            convert_value(actual, ColumnSchema("Event", "DATETIME"))

    def test_nonfinite_float_rejected(self):
        for value in ("NaN", "Infinity", "1e400"):
            with self.assertRaises(ValueError):
                convert_value(value, ColumnSchema("Reading", "FLOAT64"))

    def test_configuration_validation(self):
        with self.assertRaises(ValueError):
            SharePointSettings("https://TU_EMPRESA.sharepoint.com")
        with self.assertRaises(ValueError):
            ColumnSchema("Cost", "ARRAY")


class ExtractionTests(unittest.TestCase):
    def setUp(self):
        self.request = ExtractionRequest("Documents", "Reports", "book.xlsx", "Data",
                                        (ColumnSchema("Count", "INT64"), ColumnSchema("Id", "STRING")))

    def workbook(self, rows):
        book = MagicMock()
        book.sheetnames = ["Data"]
        book.__getitem__.return_value.iter_rows.return_value = iter(rows)
        return book

    def test_column_order_and_empty_rows(self):
        book = self.workbook([("Id", "Unused", "Count"), ("001", "x", 2), (None, None, None)])
        with patch("openpyxl.load_workbook", return_value=book):
            self.assertEqual(extract_records(b"", self.request), [{"Count": 2, "Id": "001"}])
        book.close.assert_called_once()

    def test_conversion_error_has_location_and_closes_workbook(self):
        book = self.workbook([("Id", "Count"), ("001", "1.5")])
        with patch("openpyxl.load_workbook", return_value=book):
            with self.assertRaisesRegex(ValueError, "Fila 2, columna 'Count'"):
                extract_records(b"", self.request)
        book.close.assert_called_once()

    def test_missing_or_duplicate_header(self):
        for headers in (("Id",), ("Id", "Count", "Count")):
            with patch("openpyxl.load_workbook", return_value=self.workbook([headers])):
                with self.assertRaisesRegex(ValueError, "no existe o está duplicada"):
                    extract_records(b"", self.request)

    def test_interactive_request(self):
        answers = ["Documents", "", "book.xlsx", "Data", "", "1", "Id", "integer", "n", "", ""]
        with patch("builtins.input", side_effect=answers), patch("builtins.print"):
            request = prompt_extraction_request()
        self.assertEqual(request.folder, "")
        self.assertEqual(request.columns, (ColumnSchema("Id", "INT64", nullable=False),))


class ConnectionTests(unittest.TestCase):
    def setUp(self):
        self.settings = SharePointSettings("https://example.sharepoint.com/sites/Maintenance")
        self.request = ExtractionRequest("Documentos", "Informes/Septiembre", "Costo #1%.xlsx", "Data",
                                         (ColumnSchema("Id", "STRING"),))

    def test_context_uses_user_credentials_without_ids(self):
        factory, credentials = MagicMock(), MagicMock()
        modules = {
            "office365.sharepoint.client_context": SimpleNamespace(ClientContext=factory),
            "office365.runtime.auth.user_credential": SimpleNamespace(UserCredential=credentials),
        }
        with patch.dict(sys.modules, modules):
            context = create_client_context(self.settings, " reader@example.com ", " password ")
        factory.assert_called_once_with(self.settings.site_url)
        credentials.assert_called_once_with("reader@example.com", " password ")
        factory.return_value.with_credentials.assert_called_once_with(credentials.return_value)
        self.assertIs(context, factory.return_value.with_credentials.return_value)

    def test_download_resolves_actual_library_path(self):
        context = MagicMock()
        library = context.web.lists.get_by_title.return_value
        library.root_folder.get.return_value.execute_query.return_value.properties = {
            "ServerRelativeUrl": "/sites/Maintenance/Shared Documents"
        }
        remote_file = context.web.get_file_by_server_relative_path.return_value

        def download(output):
            output.write(b"excel contents")
            return remote_file

        remote_file.download.side_effect = download
        self.assertEqual(SharePointClient(context).download_excel(self.request), b"excel contents")
        context.web.lists.get_by_title.assert_called_once_with("Documentos")
        context.web.get_file_by_server_relative_path.assert_called_once_with(
            "/sites/Maintenance/Shared Documents/Informes/Septiembre/Costo #1%.xlsx"
        )
        remote_file.execute_query.assert_called_once()

    def test_download_failure_does_not_expose_provider_details(self):
        context = MagicMock()
        context.web.lists.get_by_title.side_effect = RuntimeError("private-provider-data")
        with self.assertRaises(ConnectionSharePointError) as raised:
            SharePointClient(context).download_excel(self.request)
        self.assertNotIn("private-provider-data", str(raised.exception))
        self.assertIn("retirado", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
