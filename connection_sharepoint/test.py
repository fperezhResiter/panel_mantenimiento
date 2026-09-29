"""Manual connection check; --download also checks the selected Excel download."""

import argparse
from pathlib import Path

from connection_sharepoint.connection_sharepoint import (
    SharePointClient, create_client_context, load_settings, prompt_extraction_request,
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true", help="Pedir los datos del Excel y descargarlo")
    args = parser.parse_args()
    try:
        client = SharePointClient(create_client_context(load_settings()))
        print("Completa el inicio de sesión de Microsoft cuando aparezca el código.")
        print(f"Conexión correcta. Sitio: {client.verify_connection()}")
        if not args.download:
            return
        request = prompt_extraction_request()
        destination = Path(__file__).resolve().parent / request.file_name
        if destination.exists():
            raise ValueError(f"El destino ya existe: {destination.name}. No se sobrescribió.")
        content = client.download_excel(request)
        with destination.open("xb") as output:
            output.write(content)
        print(f"Archivo descargado: {destination}")
    except (EOFError, KeyboardInterrupt):
        parser.exit(1, "\nPrueba cancelada.\n")
    except Exception as error:
        parser.exit(1, f"Error: {error}\n")


if __name__ == "__main__":
    main()

