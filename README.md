# UnFollowers IG

Herramienta para ver quién **no te sigue de vuelta** en Instagram, directamente desde el navegador. Sin apps de terceros, sin dar tu contraseña a nadie.

---

## ¿Cómo funciona?

El script corre en tu propio navegador mientras tenés Instagram abierto. Consulta la API de Instagram usando tu sesión activa, así que no necesitás instalar nada ni darle acceso a ninguna app externa.

---

## Cómo usarlo (paso a paso)

> No necesitás saber programar. Solo seguí los pasos.

### 1. Abrí Instagram en el navegador

Andá a [instagram.com](https://www.instagram.com) e iniciá sesión con tu cuenta.

### 2. Abrí la consola del navegador

- **Chrome / Edge / Brave:** presioná `F12` o `Ctrl + Shift + J`
- **Firefox:** presioná `F12` o `Ctrl + Shift + K`
- **Safari:** activá primero el menú Desarrollador en Preferencias → Avanzado, luego `Cmd + Option + C`

### 3. Copiá el script

Abrí el archivo `script.js` de este repositorio y copiá **todo** el contenido.

O hacé clic en **[Copiar script →](https://santtisosa.github.io/UnFollowersIG___)** si preferís hacerlo desde la web.

### 4. Pegalo en la consola y presioná Enter

Pegá el código copiado en la consola del navegador y presioná `Enter`.

### 5. Listo

Se abre una interfaz dentro de Instagram que te muestra:

- Quién **no te sigue de vuelta**
- Quién **no seguís de vuelta vos**
- Opción de **whitelist** (personas que querés excluir del análisis)
- Opción de **exportar/importar** la whitelist como archivo JSON

---

## Funciones

| Función | Descripción |
|---|---|
| No me siguen de vuelta | Lista de cuentas que seguís pero que no te siguen |
| No los sigo de vuelta | Cuentas que te siguen pero que vos no seguís |
| Whitelist | Excluí cuentas del resultado (amigos, famosos, marcas) |
| Exportar whitelist | Guardá tu whitelist como archivo JSON |
| Importar whitelist | Cargá una whitelist guardada anteriormente |

---

## Preguntas frecuentes

**¿Es seguro?**  
Sí. El script corre solo en tu navegador y usa tu sesión activa. No enviamos ni guardamos ningún dato en servidores externos.

**¿Me pueden banear la cuenta?**  
El script hace solicitudes a la misma API que usa Instagram internamente. Igualmente, no abuses: no lo corras múltiples veces seguidas en poco tiempo.

**¿Funciona en celular?**  
No directamente. La consola del navegador no está disponible en los navegadores móviles normales. Necesitás una computadora.

**¿Por qué no uso una app de terceros?**  
Las apps de terceros piden tu usuario y contraseña, o acceso a tu cuenta. Eso es un riesgo de seguridad. Este script no necesita nada de eso.

---

## Contribuir

Si encontrás un bug o tenés una idea para mejorar la herramienta, abrí un [issue](https://github.com/santtisosa/UnFollowersIG___/issues) o mandá un PR.

---

## Licencia

MIT
