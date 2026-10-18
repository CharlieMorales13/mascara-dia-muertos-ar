# Una calavera de cempasúchil que se mueve contigo 💀🌼

*Borrador para LinkedIn (≈450 palabras). Agrega el video o GIF y cambia los enlaces antes de publicar.*

---

En la actividad anterior hice un filtro de zorro de fiesta que "flotaba" sobre la cara. Funcionaba, pero tenía un límite: era un modelo rígido. Si abrías la boca, la máscara no se enteraba. Para esta tercera actividad de Realidad Virtual y Aumentada el reto fue una máscara de Día de Muertos **mapeada a la malla facial**, que se ajuste a ojos, nariz, boca y contorno.

🎯 **Objetivo**
Diseñar una calavera inspirada en el Día de Muertos que se deforme con los gestos sin desprenderse, con ojos y boca transparentes y un efecto temático activado por gestos.

🛠️ **Herramientas**
MediaPipe Face Landmarker (468 landmarks y blendshapes), three.js, Python con Pillow para la textura y Web Audio API para las campanas.

🎨 **Proceso**
1. Tomé el modelo facial canónico de MediaPipe, que trae su mapa UV, y lo convertí a JSON. Cada vértice corresponde a un landmark.
2. Exporté la plantilla UV y diseñé la calavera encima: cuencas con corona de pétalos, nariz de corazón, sonrisa cosida, cempasúchil en las mejillas y papel picado en la frente.
3. En vez de calcar a ojo, anclé cada elemento a landmarks específicos (las comisuras, las fosas nasales, el contorno de los ojos), así queda alineado por construcción.
4. En cada cuadro muevo los 468 vértices de la malla a la cara detectada. La máscara abre la boca contigo, cierra los ojos contigo y gira contigo.

✨ **Gestos**
😮 Abrir la boca hace llover pétalos de cempasúchil.
🤨 Subir las cejas enciende seis veladoras alrededor de tu cara.
😑 Parpadear fuerte cambia la calavera de "día" a "noche".

🧩 **Retos**
- **Ojos y boca transparentes:** descubrí que en la malla canónica las aberturas de ojos y boca sí tienen triángulos, así que tuve que dejarlas con alfa 0 en la textura y con un pequeño margen para que no se vea un borde blanco.
- **Bordes pixeleados:** dibujo la textura al doble de resolución y la reduzco para suavizar los contornos.
- **Legibilidad:** el detalle fino se pierde en la cámara, así que usé colores saturados y contornos gruesos.
- **Respeto cultural:** quería que se sintiera como una ofrenda oaxaqueña y no como un disfraz genérico.

📈 **Mejora frente a la Actividad 2**
Pasé de un modelo rígido colocado con una matriz a una malla que se deforma con 468 puntos. Pasé de cubrir la cara a dejar ver tus ojos y tu boca, y de un modelo 3D independiente de tu rostro a una textura pintada sobre el UV facial.

✅ **Resultado**
Una máscara web que abre directo en la cámara frontal y se siente "pegada" a la piel. Ideal para estas fechas.

🎥 [video / GIF aquí]
💻 Repositorio: https://github.com/CharlieMorales13/mascara-dia-muertos-ar
🔗 Pruébalo: https://mascara-dia-muertos-ar.carlos-gomez-dev13.workers.dev/

#DíaDeMuertos #RealidadAumentada #MediaPipe #threejs #Oaxaca #Cempasúchil #FiltrosAR
