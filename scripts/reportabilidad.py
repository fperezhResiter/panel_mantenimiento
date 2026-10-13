"""Punto de entrada para los lanzadores de Windows y Mac."""
import sys
from pathlib import Path

# Permite ejecutarlo por ruta desde cualquier carpeta de trabajo.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.servidor import main

if __name__ == "__main__":
    main()
