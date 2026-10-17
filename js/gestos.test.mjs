// Prueba rápida del disparador de gestos: node js/gestos.test.mjs
import assert from 'node:assert/strict';
import { Disparador, blendshape } from './gestos.js';

const d = new Disparador(0.5, 0.3, 800);
assert.equal(d.actualizar(0.2, 0), false, 'bajo el umbral no dispara');
assert.equal(d.actualizar(0.7, 100), true, 'cruza el umbral y dispara');
assert.equal(d.actualizar(0.9, 200), false, 'gesto sostenido no repite');
assert.equal(d.actualizar(0.2, 300), false, 'se rearma al bajar');
assert.equal(d.actualizar(0.8, 400), false, 'rearmado pero dentro de la pausa');
assert.equal(d.actualizar(0.8, 950), true, 'pasada la pausa vuelve a disparar');

assert.equal(blendshape([{ categoryName: 'jawOpen', score: 0.6 }], 'jawOpen'), 0.6);
assert.equal(blendshape([], 'jawOpen'), 0);
console.log('gestos ok');
