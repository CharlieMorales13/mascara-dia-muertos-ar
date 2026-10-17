// Dispara una vez cuando el valor supera `umbral`; se rearma cuando baja de
// `rearme` y además respeta una pausa mínima entre disparos para evitar
// disparos repetidos con un gesto sostenido o con ruido del detector.
export class Disparador {
  constructor(umbral, rearme, pausaMs) {
    this.umbral = umbral;
    this.rearme = rearme;
    this.pausaMs = pausaMs;
    this.armado = true;
    this.ultimo = -Infinity;
  }

  actualizar(valor, ahora) {
    if (!this.armado) {
      if (valor < this.rearme) this.armado = true;
      return false;
    }
    if (valor > this.umbral && ahora - this.ultimo >= this.pausaMs) {
      this.armado = false;
      this.ultimo = ahora;
      return true;
    }
    return false;
  }
}

// Puntaje de un blendshape de MediaPipe por nombre (0 si no viene).
export function blendshape(categorias, nombre) {
  return categorias.find(c => c.categoryName === nombre)?.score ?? 0;
}
