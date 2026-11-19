#!/usr/bin/env python3
"""
Scraper de Pokédex → estructura local ordenada.
Fuente: PokeAPI (https://pokeapi.co) — datos públicos.
Pokemon.com bloquea scrapers (Akamai); PokeAPI es la vía estable y legal.
"""
from __future__ import annotations

import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
IMG = ROOT / "assets" / "sprites"
BASE = "https://pokeapi.co/api/v2"
# 151 = Gen 1 (rápido). 1025 = National Dex completa (tarda varios minutos)
LIMIT = 151
WORKERS = 12
SESSION = requests.Session()
SESSION.headers.update(
    {"User-Agent": "PokedexClone/1.0 (local educational; +pokeapi.co)"}
)

TYPE_ES = {
    "normal": "Normal",
    "fighting": "Lucha",
    "flying": "Volador",
    "poison": "Veneno",
    "ground": "Tierra",
    "rock": "Roca",
    "bug": "Bicho",
    "ghost": "Fantasma",
    "steel": "Acero",
    "fire": "Fuego",
    "water": "Agua",
    "grass": "Planta",
    "electric": "Eléctrico",
    "psychic": "Psíquico",
    "ice": "Hielo",
    "dragon": "Dragón",
    "dark": "Siniestro",
    "fairy": "Hada",
    "stellar": "Astral",
    "unknown": "Desconocido",
}

# Debilidades base (atacante → defensa) simplificado se calcula con type relations de API
STAT_ES = {
    "hp": "PS",
    "attack": "Ataque",
    "defense": "Defensa",
    "special-attack": "At. Esp.",
    "special-defense": "Def. Esp.",
    "speed": "Velocidad",
}


def get(url: str, retries: int = 4):
    for i in range(retries):
        try:
            r = SESSION.get(url, timeout=30)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 404:
                return None
            time.sleep(0.4 * (i + 1))
        except requests.RequestException:
            time.sleep(0.5 * (i + 1))
    return None


def spanish_name(species: dict) -> str:
    for n in species.get("names") or []:
        if n.get("language", {}).get("name") == "es":
            return n["name"]
    return species.get("name", "").title()


def spanish_genus(species: dict) -> str:
    for g in species.get("genera") or []:
        if g.get("language", {}).get("name") == "es":
            return g.get("genus", "")
    return ""


def spanish_flavor(species: dict) -> str:
    # Prefer Spanish, latest version
    texts = [
        e
        for e in (species.get("flavor_text_entries") or [])
        if e.get("language", {}).get("name") == "es"
    ]
    if not texts:
        texts = [
            e
            for e in (species.get("flavor_text_entries") or [])
            if e.get("language", {}).get("name") == "en"
        ]
    if not texts:
        return ""
    # last entry usually newest
    t = texts[-1].get("flavor_text", "")
    return " ".join(t.replace("\n", " ").replace("\f", " ").split())


def ability_es(url: str) -> dict:
    data = get(url)
    if not data:
        return {"name": "", "name_es": ""}
    name_es = data["name"]
    for n in data.get("names") or []:
        if n.get("language", {}).get("name") == "es":
            name_es = n["name"]
            break
    return {"name": data["name"], "name_es": name_es}


def fetch_one(pid: int) -> dict | None:
    poke = get(f"{BASE}/pokemon/{pid}")
    if not poke:
        return None
    species = get(poke["species"]["url"]) or {}

    types = []
    for t in poke.get("types") or []:
        en = t["type"]["name"]
        types.append({"en": en, "es": TYPE_ES.get(en, en.title())})

    abilities = []
    for a in poke.get("abilities") or []:
        ab = ability_es(a["ability"]["url"])
        abilities.append(
            {
                **ab,
                "is_hidden": a.get("is_hidden", False),
                "slot": a.get("slot"),
            }
        )

    stats = {}
    for s in poke.get("stats") or []:
        key = s["stat"]["name"]
        stats[key] = {
            "value": s["base_stat"],
            "name_es": STAT_ES.get(key, key),
        }

    sprites = poke.get("sprites") or {}
    other = sprites.get("other") or {}
    official = (other.get("official-artwork") or {}).get("front_default")
    home = (other.get("home") or {}).get("front_default")
    default = sprites.get("front_default")

    # type effectiveness (defense)
    weaknesses = set()
    for t in types:
        rel = get(f"{BASE}/type/{t['en']}")
        if not rel:
            continue
        dmg = rel.get("damage_relations") or {}
        for x in dmg.get("double_damage_from") or []:
            weaknesses.add(x["name"])
        # if dual type, 4x still listed once; 1/2 cancels would need full calc
    # crude cancel: remove types that resist
    resist = set()
    for t in types:
        rel = get(f"{BASE}/type/{t['en']}")
        if not rel:
            continue
        dmg = rel.get("damage_relations") or {}
        for x in dmg.get("half_damage_from") or []:
            resist.add(x["name"])
        for x in dmg.get("no_damage_from") or []:
            resist.add(x["name"])
    weak_list = sorted(weaknesses - resist)

    entry = {
        "id": poke["id"],
        "number": f"{poke['id']:04d}",
        "name": poke["name"],
        "name_es": spanish_name(species),
        "genus_es": spanish_genus(species),
        "flavor_es": spanish_flavor(species),
        "types": types,
        "height_m": round((poke.get("height") or 0) / 10, 1),
        "weight_kg": round((poke.get("weight") or 0) / 10, 1),
        "abilities": abilities,
        "stats": stats,
        "weaknesses": [
            {"en": w, "es": TYPE_ES.get(w, w.title())} for w in weak_list
        ],
        "sprites": {
            "official": official,
            "home": home,
            "default": default,
            "local": f"assets/sprites/{poke['id']:04d}.png",
        },
        "generation": (species.get("generation") or {}).get("name"),
        "is_legendary": species.get("is_legendary", False),
        "is_mythical": species.get("is_mythical", False),
        "color": (species.get("color") or {}).get("name"),
        "habitat": (species.get("habitat") or {}).get("name"),
        "evolution_chain_url": (species.get("evolution_chain") or {}).get("url"),
    }
    return entry


def download_sprite(entry: dict) -> None:
    url = entry["sprites"].get("official") or entry["sprites"].get("default")
    if not url:
        return
    dest = IMG / f"{entry['id']:04d}.png"
    if dest.exists() and dest.stat().st_size > 500:
        return
    try:
        r = SESSION.get(url, timeout=30)
        if r.status_code == 200:
            dest.write_bytes(r.content)
    except requests.RequestException:
        pass


def main():
    DATA.mkdir(parents=True, exist_ok=True)
    IMG.mkdir(parents=True, exist_ok=True)

    print(f"Descargando {LIMIT} Pokémon desde PokeAPI…")
    results: list[dict] = []
    errors = 0

    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = {ex.submit(fetch_one, i): i for i in range(1, LIMIT + 1)}
        done = 0
        for fut in as_completed(futs):
            done += 1
            pid = futs[fut]
            try:
                entry = fut.result()
                if entry:
                    results.append(entry)
                else:
                    errors += 1
            except Exception as e:
                errors += 1
                print(f"  error #{pid}: {e}")
            if done % 50 == 0 or done == LIMIT:
                print(f"  {done}/{LIMIT} ({len(results)} ok, {errors} fallos)")

    results.sort(key=lambda x: x["id"])

    # index ligero para la web
    index = [
        {
            "id": p["id"],
            "number": p["number"],
            "name": p["name"],
            "name_es": p["name_es"],
            "types": p["types"],
            "sprite": p["sprites"]["local"],
            "sprite_remote": p["sprites"]["official"] or p["sprites"]["default"],
            "is_legendary": p["is_legendary"],
            "is_mythical": p["is_mythical"],
        }
        for p in results
    ]

    (DATA / "pokemon_index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (DATA / "pokemon_full.json").write_text(
        json.dumps(results, ensure_ascii=False), encoding="utf-8"
    )

    # un archivo por Pokémon (detalle)
    detail_dir = DATA / "pokemon"
    detail_dir.mkdir(exist_ok=True)
    for p in results:
        (detail_dir / f"{p['id']:04d}.json").write_text(
            json.dumps(p, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    # meta tipos
    types_meta = [{"en": k, "es": v} for k, v in TYPE_ES.items() if k not in ("unknown",)]
    (DATA / "types.json").write_text(
        json.dumps(types_meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    meta = {
        "source": "https://pokeapi.co",
        "inspired_by": "https://www.pokemon.com/el/pokedex",
        "count": len(results),
        "limit": LIMIT,
        "generated": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "structure": {
            "data/pokemon_index.json": "Lista ligera (cards)",
            "data/pokemon_full.json": "Todos los detalles en un JSON",
            "data/pokemon/NNNN.json": "Detalle individual",
            "data/types.json": "Tipos EN/ES",
            "assets/sprites/NNNN.png": "Artwork oficial (opcional)",
        },
    }
    (DATA / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print("Descargando sprites oficiales…")
    with ThreadPoolExecutor(max_workers=8) as ex:
        list(ex.map(download_sprite, results))

    print(f"\n✓ Listo: {len(results)} Pokémon")
    print(f"  {DATA / 'pokemon_index.json'}")
    print(f"  {DATA / 'pokemon_full.json'}")
    print(f"  {detail_dir} ({len(list(detail_dir.glob('*.json')))} archivos)")
    print(f"  {IMG} sprites")


if __name__ == "__main__":
    main()
