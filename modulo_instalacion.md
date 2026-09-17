# Notas — equipos en línea / respaldo local

Requisito original (usuario):

> Cuando se pierde conexión con la API que trae los dispositivos, no se presenta ningún dispositivo. El sistema debe almacenar de manera interna y propia los dispositivos que se conectan y hasta cuándo se conectaron, de forma que si se pierde conexión o ya no hay información del dispositivo al menos tengamos los últimos datos y las últimas 12 horas de funcionamiento. Esto se activa cuando no hay acceso a la API; el usuario no siente que se perdió el dispositivo: puede revisar última información y los demás módulos. La parte de control queda limitada si no se tiene conexión del equipo al menos en los últimos 30 minutos. Idea: base de datos local de la información obtenida de la API como respaldo.

**Plan validado y diseño técnico:** ver [`equipos_en_linea.md`](./equipos_en_linea.md).
