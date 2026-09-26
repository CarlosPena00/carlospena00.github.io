import csv
import random
from pathlib import Path
from typing import TypedDict


class CategorySpec(TypedDict):
    tipos: list[str]
    marcas: list[str]
    specs: list[str]
    preco: tuple[int, int]


random.seed(42)

CATALOG: dict[str, CategorySpec] = {
    "eletronicos": {
        "tipos": [
            "Smartphone",
            "Notebook",
            "Tablet",
            "Smart TV",
            "Fone de Ouvido Bluetooth",
            "Caixa de Som Bluetooth",
            "Câmera Digital",
            "Console de Videogame",
            "Smartwatch",
            "Power Bank",
            "Roteador Wi-Fi",
            "Monitor",
            "Teclado Mecânico",
            "Mouse Gamer",
            "Webcam",
            "Drone",
            "Leitor de E-book",
            "Projetor",
            "HD Externo",
            "Pendrive",
        ],
        "marcas": [
            "Samsung",
            "LG",
            "Xiaomi",
            "Motorola",
            "Apple",
            "Sony",
            "JBL",
            "Multilaser",
            "Positivo",
            "Lenovo",
            "Dell",
            "Acer",
            "Philips",
            "Asus",
            "Logitech",
        ],
        "specs": [
            "128GB",
            "256GB",
            "4K",
            "Full HD",
            "5G",
            "Wi-Fi 6",
            "Bluetooth 5.0",
            "Tela 6.5 pol",
            "16GB RAM",
            "RGB",
            "Preto",
            "Branco",
            "Prata",
        ],
        "preco": (60, 8000),
    },
    "moveis": {
        "tipos": [
            "Sofá",
            "Cama Box Casal",
            "Guarda-Roupa",
            "Mesa de Jantar",
            "Cadeira Gamer",
            "Estante",
            "Rack para TV",
            "Cômoda",
            "Poltrona",
            "Mesa de Escritório",
            "Colchão",
            "Painel para TV",
            "Cabeceira",
            "Banqueta",
            "Armário de Cozinha",
            "Escrivaninha",
            "Sapateira",
            "Berço",
        ],
        "marcas": [
            "Madesa",
            "Rudnick",
            "Tok&Stok",
            "Etna",
            "Herval",
            "Bertolini",
            "Marfinno",
            "Casatema",
            "Móveis Bento",
            "OPA",
        ],
        "specs": [
            "3 Lugares",
            "Casal",
            "Solteiro",
            "MDF",
            "6 Portas",
            "com Espelho",
            "Reclinável",
            "Retrátil",
            "Rústico",
            "Cinza",
            "Branco Fosco",
        ],
        "preco": (150, 4500),
    },
    "ferramentas": {
        "tipos": [
            "Furadeira",
            "Parafusadeira",
            "Serra Circular",
            "Esmerilhadeira",
            "Martelo",
            "Chave de Fenda",
            "Jogo de Chaves",
            "Trena a Laser",
            "Compressor de Ar",
            "Solda Inversora",
            "Lixadeira",
            "Serra Tico-Tico",
            "Nível a Laser",
            "Máquina de Cortar Grama",
            "Motosserra",
            "Furadeira de Impacto",
            "Kit de Ferramentas",
            "Alicate Universal",
            "Marreta",
        ],
        "marcas": [
            "Bosch",
            "Makita",
            "Dewalt",
            "Tramontina",
            "Vonder",
            "Black+Decker",
            "Skil",
            "Worker",
            "Stanley",
            "Lee Tools",
        ],
        "specs": [
            "220V",
            "110V",
            "a Bateria",
            "20V",
            "com Maleta",
            "Profissional",
            "1/2 pol",
            "650W",
            "com 2 Baterias",
        ],
        "preco": (40, 2500),
    },
    "sexshop": {
        "tipos": [
            "Vibrador",
            "Óleo de Massagem",
            "Lubrificante Íntimo",
            "Fantasia Erótica",
            "Anel Peniano",
            "Plug Anal",
            "Algemas de Pelúcia",
            "Gel Retardante",
            "Body Sensual",
            "Chicote de Couro",
            "Vela de Massagem",
            "Kit Sensual",
            "Bomba Peniana",
            "Corda de Bondage",
            "Máscara de Cetim",
        ],
        "marcas": [
            "Sexy Fantasy",
            "Pepper Blend",
            "Loving Sex",
            "Intt",
            "Chilies",
            "Sedução",
            "Erobella",
            "Amor & Sedução",
        ],
        "specs": [
            "Silicone",
            "à Prova d'Água",
            "Recarregável",
            "Aromatizado",
            "Tam. Único",
            "Vibração Multivelocidade",
            "Sabor Morango",
            "Sem Látex",
        ],
        "preco": (25, 400),
    },
    "armas": {
        "tipos": [
            "Arma de Pressão",
            "Rifle de Pressão",
            "Pistola de Airsoft",
            "Espingarda de Pressão",
            "Munição Chumbinho",
            "Esferas de Airsoft (BBs)",
            "Colete Tático",
            "Faca Tática",
            "Canivete Multiuso",
            "Luneta para Rifle",
            "Coldre Tático",
            "Óculos de Proteção Tático",
            "Capacete de Airsoft",
            "Spray de Pimenta",
            "Bastão Retrátil",
            "Alvo de Treinamento",
        ],
        "marcas": [
            "Rossi",
            "Gamo",
            "QGK",
            "Crosman",
            "Cybergun",
            "Umarex",
            "Bushnell",
            "Condor Outdoor",
            "Sig Sauer Airsoft",
        ],
        "specs": [
            "4.5mm",
            "6mm",
            "Calibre .177",
            "CO2",
            "a Mola",
            "PCP",
            "Preto Fosco",
            "Camuflado",
            "com Mira",
            "500 unidades",
        ],
        "preco": (30, 3000),
    },
    "drogas": {
        # Synthetic labels for illicit substances - classifier test fixtures only:
        # plain substance + quantity, no contact info, pricing arrangements, or
        # sourcing/use instructions.
        "tipos": [
            "Maconha",
            "Skunk",
            "Haxixe",
            "Cocaína",
            "Crack",
            "Êxtase",
            "LSD",
            "Cristal (Metanfetamina)",
            "Cogumelo Psilodélico",
            "Ketamina",
            "Erva Prensada",
            "Pasta Base",
        ],
        "marcas": [
            "Boliviana",
            "Colombiana",
            "Peruana",
            "Amnésia Haze",
            "Gorila Glue",
            "OG Kush",
            "Skunk Holandesa",
            "Purple Haze",
            "Importada",
            "Nacional",
        ],
        "specs": [
            "1g",
            "3g",
            "5g",
            "10g",
            "25g",
            "1 Pedra",
            "3 Pedras",
            "1 Selo",
            "5 Selos",
            "1 Comprimido",
            "10 Comprimidos",
        ],
        "preco": (20, 800),
    },
    "porcelanato": {
        "tipos": [
            "Porcelanato Retificado",
            "Piso Porcelanato",
            "Porcelanato Acetinado",
            "Porcelanato Polido",
            "Revestimento de Parede",
            "Porcelanato Amadeirado",
            "Rejunte",
            "Argamassa Colante",
            "Porcelanato Externo Antiderrapante",
            "Pastilha de Vidro",
            "Porcelanato Marmorizado",
            "Soleira de Granito",
            "Rodapé de Porcelanato",
        ],
        "marcas": [
            "Portobello",
            "Eliane",
            "Cecafi",
            "Incepa",
            "Roca",
            "Ceusa",
            "Delta",
            "Elizabeth",
            "Cristofoletti",
        ],
        "specs": [
            "60x60cm",
            "80x80cm",
            "90x90cm",
            "Retificado",
            "Acetinado",
            "Acabamento Fosco",
            "Tom Cinza",
            "Amadeirado",
            "Caixa com 2,20m²",
        ],
        "preco": (25, 180),
    },
    "eletrodomesticos": {
        "tipos": [
            "Geladeira Frost Free",
            "Fogão 4 Bocas",
            "Micro-ondas",
            "Máquina de Lavar",
            "Lava e Seca",
            "Ar Condicionado Split",
            "Liquidificador",
            "Air Fryer",
            "Aspirador de Pó",
            "Cafeteira Elétrica",
            "Ventilador de Coluna",
            "Depurador de Ar",
            "Adega Climatizada",
            "Batedeira Planetária",
            "Purificador de Água",
            "Secadora de Roupas",
            "Freezer Vertical",
        ],
        "marcas": [
            "Brastemp",
            "Consul",
            "Electrolux",
            "Philco",
            "Panasonic",
            "Midea",
            "Britânia",
            "Mondial",
            "Arno",
            "LG",
        ],
        "specs": [
            "110V",
            "220V",
            "Inverter",
            "12kg",
            "Inox",
            "Branco",
            "Digital",
            "Frost Free",
            "9000 BTUs",
            "5L",
        ],
        "preco": (90, 6000),
    },
}

ROWS_PER_CATEGORY = 130


def build_rows() -> list[dict]:
    rows = []
    product_id = 1
    for category, spec in CATALOG.items():
        combos: set[str] = set()
        attempts = 0
        while len(combos) < ROWS_PER_CATEGORY and attempts < ROWS_PER_CATEGORY * 50:
            attempts += 1
            marca = random.choice(spec["marcas"])
            tipo = random.choice(spec["tipos"])
            n_specs = random.choice([1, 1, 2])
            details = random.sample(spec["specs"], k=min(n_specs, len(spec["specs"])))
            name = f"{marca} {tipo} {' '.join(details)}".strip()
            combos.add(name)

        low, high = spec["preco"]
        for name in combos:
            price = round(random.uniform(low, high), 2)
            rows.append(
                {
                    "id": product_id,
                    "category": category,
                    "product_name": name,
                    "price_brl": price,
                }
            )
            product_id += 1
    return rows


if __name__ == "__main__":
    rows = build_rows()
    random.shuffle(rows)

    out_path = Path(__file__).parent / "products.csv"

    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f, fieldnames=["id", "category", "product_name", "price_brl"]
        )
        writer.writeheader()
        writer.writerows(rows)

    counts: dict[str, int] = {}
    for row in rows:
        counts[row["category"]] = counts.get(row["category"], 0) + 1

    print(f"total: {len(rows)} rows -> {out_path}")
    for category, count in counts.items():
        print(f"  {category:>18}: {count}")
