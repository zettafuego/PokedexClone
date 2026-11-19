# Pokédex Clone — estructura ordenada

Clon local inspirado en [pokemon.com/el/pokedex](https://www.pokemon.com/el/pokedex).

## ¿Por qué no scrapear pokemon.com directo?

El sitio de **The Pokémon Company** usa protección (Akamai) y devuelve HTML de bloqueo a scrapers.
Los datos se obtienen de **[PokeAPI](https://pokeapi.co)** (API pública, misma base de datos de la comunidad).

## Estructura del proyecto

```
PokedexClone/
├── index.html                 # UI principal (estilo Pokédex)
├── Abrir_Pokedex.bat          # Servidor local + abrir navegador
├── scrape_pokedex.py          # Web scraping / descarga de datos
├── README.md
│
├── css/
│   └── styles.css             # Estilos (grid, tipos, modal)
│
├── js/
│   └── app.js                 # Búsqueda, filtros, detalle
│
├── data/                      # ← datos scrapeados (JSON)
│   ├── meta.json              # Metadatos del scrape
│   ├── types.json             # Tipos EN ↔ ES
│   ├── pokemon_index.json     # Lista ligera (cards)     ★ principal UI
│   ├── pokemon_full.json      # Todos los detalles en 1 archivo
│   └── pokemon/
│       ├── 0001.json          # Bulbasaur (detalle)
│       ├── 0002.json
│       └── … NNNN.json
│
└── assets/
    └── sprites/               # se descargan en local, no van al repositorio
        ├── 0001.png
        └── … NNNN.png
```

Los PNG son artwork oficial de Pokémon y se quedan en esta computadora. El repositorio lleva la interfaz, el script y el JSON de PokeAPI.

### Modelo de datos (cada `pokemon/NNNN.json`)

```json
{
  "id": 25,
  "number": "0025",
  "name": "pikachu",
  "name_es": "Pikachu",
  "genus_es": "Pokémon Ratón",
  "flavor_es": "…",
  "types": [{ "en": "electric", "es": "Eléctrico" }],
  "height_m": 0.4,
  "weight_kg": 6.0,
  "abilities": [{ "name": "static", "name_es": "Elec. Estática", "is_hidden": false }],
  "stats": { "hp": { "value": 35, "name_es": "PS" }, … },
  "weaknesses": [{ "en": "ground", "es": "Tierra" }],
  "sprites": { "official": "https://…", "local": "assets/sprites/0025.png" },
  "is_legendary": false,
  "is_mythical": false
}
```

## Uso rápido

```bat
cd "C:\Users\Eduardo\Documents\1. Programación\PokedexClone"

:: 1) Descargar datos (solo la primera vez o para actualizar)
python scrape_pokedex.py

:: 2) Abrir
Abrir_Pokedex.bat
```

Requisito: `pip install requests`

## Funciones de la UI

| Función | Descripción |
|---------|-------------|
| Búsqueda | Nombre ES/EN o número |
| Filtro tipo | Chips multi-tipo (AND) |
| Orden | Nº asc/desc, A–Z, Z–A |
| Sorpréndeme | Pokémon aleatorio |
| Ficha | Modal con stats, habilidades, debilidades, flavor ES |

## Ajustar cantidad

En `scrape_pokedex.py`:

```python
LIMIT = 1025   # National Dex
WORKERS = 12   # paralelismo
```

## Licencia / uso

- Datos: [PokeAPI](https://pokeapi.co) (uso no comercial de la API).
- Nombres/imágenes de Pokémon © Nintendo / Creatures / GAME FREAK / TPC.
- Este repo es **educativo / personal**, no afiliado a The Pokémon Company.
