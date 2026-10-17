"""Convierte el modelo facial canónico de MediaPipe (OBJ) a assets/malla_facial.json.

Uso: python textura/obj_a_json.py

En el OBJ cada vértice usa siempre la misma coordenada UV, así que se guarda
una UV por vértice (índice de vértice = índice de landmark de MediaPipe).
"""
import json
import os

AQUI = os.path.dirname(os.path.abspath(__file__))
V, T, F = [], [], []
for linea in open(os.path.join(AQUI, "canonical_face_model.obj")):
    p = linea.split()
    if not p:
        continue
    if p[0] == "v":
        V.append([float(x) for x in p[1:4]])
    elif p[0] == "vt":
        T.append([float(x) for x in p[1:3]])
    elif p[0] == "f":
        F.append([tuple(int(x) - 1 for x in q.split("/")[:2]) for q in p[1:]])

uv = [None] * len(V)
for cara in F:
    for v, t in cara:
        assert uv[v] in (None, T[t]), "vértice con dos UV distintas"
        uv[v] = T[t]

json.dump({
    "posiciones": [round(c, 4) for v in V for c in v],
    "uvs": [round(c, 6) for u in uv for c in u],
    "indices": [v for cara in F for v, _ in cara],
}, open(os.path.join(os.path.dirname(AQUI), "assets", "malla_facial.json"), "w"), separators=(",", ":"))
print(f"{len(V)} vértices, {len(F)} triángulos")
