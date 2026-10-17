"""Textura de calavera oaxaqueña sobre el mapa UV del modelo facial canónico de MediaPipe.

Uso:  python textura/generar_textura.py
Requiere: pip install pillow

Genera en assets/:
    calavera_cempasuchil.png   variante principal (naranja / amarillo)
    calavera_noche.png         variante de noche (morado / rosa), se activa con un gesto
y en textura/:
    plantilla_uv.png           malla UV para pintar encima en Krita/Photoshop

Cada elemento se ancla a landmarks de MediaPipe (índices de vértice), así que
ojos, nariz y boca quedan exactamente sobre los de la malla. Ojos y boca
interior quedan transparentes (alfa 0).
"""
import json
import math
import os

from PIL import Image, ImageDraw, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
S = 2048  # se dibuja al doble y se reduce a 1024 para suavizar bordes

malla = json.load(open(os.path.join(RAIZ, "assets", "malla_facial.json")))
UV = malla["uvs"]
TRIS = [malla["indices"][i:i + 3] for i in range(0, len(malla["indices"]), 3)]


def P(i):
    """Landmark i → píxel en la textura (v crece hacia arriba en el UV)."""
    return (UV[2 * i] * S, (1 - UV[2 * i + 1]) * S)


def centro(ids):
    pts = [P(i) for i in ids]
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def escalar(ids, k, c=None):
    c = c or centro(ids)
    return [(c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k) for x, y in map(P, ids)]


def mezclar(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


# contornos de MediaPipe Face Mesh
OJO_DER = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
OJO_IZQ = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466]
LABIO_INT = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191]
LABIO_EXT = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]
OVALO = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
         152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]

PALETAS = {
    "cempasuchil": dict(hueso=(247, 242, 232), sombra=(214, 204, 222), negro=(24, 12, 28),
                        petalo1=(255, 122, 0), petalo2=(255, 184, 0), centro=(190, 60, 0),
                        acento1=(230, 0, 126), acento2=(123, 44, 191), acento3=(0, 179, 166), hoja=(58, 157, 35)),
    "noche": dict(hueso=(232, 224, 247), sombra=(180, 160, 215), negro=(18, 10, 48),
                  petalo1=(230, 0, 126), petalo2=(186, 104, 255), centro=(90, 20, 140),
                  acento1=(255, 184, 0), acento2=(0, 179, 166), acento3=(255, 122, 0), hoja=(0, 140, 120)),
}


def petalo(d, c, ang, largo, ancho, color, base=0.0):
    """Pétalo en forma de gota apuntando en dirección `ang`."""
    pts = []
    for k in range(20):
        t = k / 19 * math.pi
        r = math.sin(t)
        x = base + (1 - math.cos(t)) / 2 * largo
        y = r * ancho / 2 * (1 - 0.4 * (1 - math.cos(t)) / 2)
        pts.append((x, y))
    pts += [(x, -y) for x, y in reversed(pts)]
    ca, sa = math.cos(ang), math.sin(ang)
    d.polygon([(c[0] + x * ca - y * sa, c[1] + x * sa + y * ca) for x, y in pts], fill=color)


def cempasuchil(d, c, r, pal, giro=0.0):
    """Flor de cempasúchil: capas de pétalos y centro con puntos."""
    for capa, (n, k, col) in enumerate([(14, 1.0, pal["petalo1"]), (12, 0.78, pal["petalo2"]), (10, 0.55, pal["petalo1"])]):
        for i in range(n):
            a = giro + i / n * 2 * math.pi + capa * 0.3
            petalo(d, c, a, r * k, r * k * 0.5, col, base=r * 0.1)
    d.ellipse([c[0] - r * 0.25, c[1] - r * 0.25, c[0] + r * 0.25, c[1] + r * 0.25], fill=pal["centro"])
    for i in range(6):
        a = i / 6 * 2 * math.pi
        x, y = c[0] + math.cos(a) * r * 0.13, c[1] + math.sin(a) * r * 0.13
        d.ellipse([x - r * 0.04, y - r * 0.04, x + r * 0.04, y + r * 0.04], fill=pal["petalo2"])


def hoja(d, c, ang, largo, pal):
    petalo(d, c, ang, largo, largo * 0.38, pal["hoja"])


def punto(d, c, r, color):
    d.ellipse([c[0] - r, c[1] - r, c[0] + r, c[1] + r], fill=color)


def papel_picado(d, pal, unidad):
    """Guirnalda de papel picado sobre la frente, siguiendo el borde superior del óvalo."""
    arco = [103, 67, 109, 10, 338, 297, 332]
    cf = centro(OVALO)
    # cuerda: el borde superior desplazado hacia adentro
    cuerda = [mezclar(P(i), cf, 0.05) for i in arco]
    d.line(cuerda, fill=pal["negro"], width=int(unidad * 0.12), joint="curve")
    colores = [pal["acento1"], pal["petalo1"], pal["acento2"], pal["acento3"], pal["petalo2"], pal["acento1"]]
    for k in range(len(cuerda) - 1):
        a, b = cuerda[k], cuerda[k + 1]
        alto = unidad * 0.8
        # bandera trapezoidal con borde inferior en zigzag
        abajo_a = (a[0], a[1] + alto)
        abajo_b = (b[0], b[1] + alto)
        borde = []
        for z in range(9):
            t = z / 8
            x, y = mezclar(abajo_b, abajo_a, t)
            borde.append((x, y + (unidad * 0.18 if z % 2 else 0)))
        d.polygon([a, b] + borde, fill=colores[k % len(colores)])
        # recortes del papel: rombo y círculos
        cx, cy = mezclar(a, b, 0.5)
        cy += alto * 0.45
        s = unidad * 0.22
        d.polygon([(cx, cy - s), (cx + s, cy), (cx, cy + s), (cx - s, cy)], fill=pal["hueso"])
        for dx in (-1, 1):
            punto(d, (cx + dx * s * 1.7, cy - s * 0.6), s * 0.35, pal["hueso"])


def generar(nombre, pal):
    img = Image.new("RGBA", (S, S), pal["hueso"] + (255,))
    d = ImageDraw.Draw(img)
    unidad = dist(P(33), P(133))  # ancho de un ojo, escala de referencia

    # sombreado suave en el contorno para dar volumen
    d.line([P(i) for i in OVALO + OVALO[:1]], fill=pal["sombra"], width=int(unidad * 0.22), joint="curve")

    papel_picado(d, pal, unidad)

    # cuencas: corona de pétalos + cuenca oscura
    for ojo in (OJO_DER, OJO_IZQ):
        c = centro(ojo)
        r = max(dist(c, P(i)) for i in ojo)
        # cuenca redonda: el ojo es plano, se estira más en vertical
        cuenca = [(c[0] + (x - c[0]) * 1.45, c[1] + (y - c[1]) * 2.6) for x, y in map(P, ojo)]
        for k in range(28):
            a = k / 28 * 2 * math.pi
            rb = r * (1.25 + 0.3 * abs(math.sin(a)))  # sigue la forma de la cuenca
            largo = r * (0.55 if k % 2 else 0.42)
            petalo(d, c, a, largo, r * 0.36, pal["petalo1"] if k % 2 else pal["petalo2"], base=rb)
        d.polygon(cuenca, fill=pal["negro"])
        d.line(cuenca + cuenca[:1], fill=pal["acento1"], width=int(unidad * 0.06), joint="curve")

    # nariz: corazón invertido (lóbulos en las fosas, punta hacia el puente)
    lobulo_d = mezclar(P(98), P(4), 0.2)
    lobulo_i = mezclar(P(327), P(4), 0.2)
    rl = dist(P(98), P(327)) * 0.24
    punta = P(195)
    for lc in (lobulo_d, lobulo_i):
        punto(d, lc, rl, pal["negro"])
    d.polygon([(lobulo_d[0] - rl, lobulo_d[1]), (lobulo_i[0] + rl, lobulo_i[1]), punta], fill=pal["negro"])

    # mejillas: cempasúchil con hojas y espiral de puntos
    for i_mej, giro, lado in ((50, 0.2, -1), (280, -0.2, 1)):
        c = P(i_mej)
        r = unidad * 0.62
        hoja(d, c, math.pi / 2 + lado * 0.9, r * 1.6, pal)
        hoja(d, c, math.pi / 2 + lado * 0.2, r * 1.4, pal)
        cempasuchil(d, c, r, pal, giro)
        for k in range(6):  # arco de puntos bajo la flor
            a = math.pi * (0.2 + 0.12 * k)
            punto(d, (c[0] + math.cos(a) * r * 1.3, c[1] + math.sin(a) * r * 1.3), unidad * 0.06, pal["acento3"])

    # sienes: flores pequeñas
    for i_sien, lado in ((127, -1), (356, 1)):
        c = mezclar(P(i_sien), centro(OVALO), 0.12)
        cempasuchil(d, c, unidad * 0.38, pal, lado * 0.5)

    # boca: labios oscuros, puntadas y sonrisa cosida hasta las mejillas
    d.polygon([P(i) for i in LABIO_EXT], fill=pal["negro"])
    for k in range(1, 12):
        t = k / 12
        sup = mezclar(P(61), P(291), t)
        y_sup = min(P(i)[1] for i in (0, 37, 267)) - unidad * 0.05
        y_inf = max(P(i)[1] for i in (17, 84, 314)) + unidad * 0.05
        d.line([(sup[0], y_sup), (sup[0], y_inf)], fill=pal["hueso"], width=int(unidad * 0.05))
    for esquina, mejilla in ((61, 214), (291, 434)):
        a, b = P(esquina), mezclar(P(esquina), P(mejilla), 0.85)
        d.line([a, b], fill=pal["negro"], width=int(unidad * 0.07))
        for k in range(1, 5):
            m = mezclar(a, b, k / 5)
            d.line([(m[0], m[1] - unidad * 0.15), (m[0], m[1] + unidad * 0.15)], fill=pal["negro"], width=int(unidad * 0.05))

    # barbilla: abanico de pétalos y puntos
    cb = mezclar(P(152), P(17), 0.45)
    for k in range(7):
        a = -math.pi / 2 + (k - 3) * 0.32
        petalo(d, cb, a + math.pi, unidad * 0.55, unidad * 0.22, pal["acento2"] if k % 2 else pal["acento1"])
    punto(d, cb, unidad * 0.12, pal["petalo2"])

    # borde decorativo de puntos dentro del óvalo
    cf = centro(OVALO)
    for k, i in enumerate(OVALO):
        if i in (10, 338, 297, 332, 103, 67, 109):  # ahí va el papel picado
            continue
        punto(d, mezclar(P(i), cf, 0.06), unidad * 0.055, [pal["acento1"], pal["acento2"], pal["acento3"]][k % 3])

    # ojos y boca interior transparentes (con un pequeño margen)
    alfa = Image.new("L", (S, S), 255)
    da = ImageDraw.Draw(alfa)
    for zona in (OJO_DER, OJO_IZQ):
        da.polygon(escalar(zona, 1.12), fill=0)
    da.polygon(escalar(LABIO_INT, 1.05), fill=0)
    alfa = alfa.filter(ImageFilter.GaussianBlur(2))
    img.putalpha(alfa)

    img = img.resize((S // 2, S // 2), Image.LANCZOS)
    img.save(os.path.join(RAIZ, "assets", f"calavera_{nombre}.png"), optimize=True)


def plantilla():
    """Malla UV para pintar encima en un editor de imágenes."""
    img = Image.new("RGB", (S // 2, S // 2), (255, 255, 255))
    d = ImageDraw.Draw(img)
    h = lambda i: (P(i)[0] / 2, P(i)[1] / 2)
    for t in TRIS:
        d.polygon([h(i) for i in t], outline=(150, 150, 150))
    for zona, col in ((OJO_DER, (0, 120, 255)), (OJO_IZQ, (0, 120, 255)), (LABIO_INT, (255, 0, 80)), (OVALO, (0, 160, 0))):
        d.line([h(i) for i in zona + zona[:1]], fill=col, width=3)
    img.save(os.path.join(AQUI, "plantilla_uv.png"))


if __name__ == "__main__":
    for nombre, pal in PALETAS.items():
        generar(nombre, pal)
    plantilla()
    print("texturas generadas")
