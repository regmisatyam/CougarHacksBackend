# Assets Folder

## 📁 Folder Structure

```
assets/
├── fonts/
│   ├── font.ttf      ✅ Custom body font (loaded)
│   └── logoFont.ttf  ✅ Custom heading font (loaded)
└── bg.jpg           ⚠️  ADD YOUR BACKGROUND IMAGE HERE
```

---

## 🖼️ Add Your Background Image

**Place your background image here with one of these names:**
- `bg.jpg` (recommended)
- `bg.png`
- `bg.webp`
- `bg.gif`

**Example:**
```bash
# Copy your background:
cp /path/to/your/image.jpg ./bg.jpg
```

---

## ✅ Fonts

Custom fonts are already loaded from the `fonts/` folder:
- **font.ttf** → Used for body text
- **logoFont.ttf** → Used for headings and logo

---

## 💡 Tips

### Background Image
- **Size:** At least 1920x1080px
- **Format:** JPG (smaller), PNG (quality), WebP (best)
- **Optimize:** Keep under 500KB for performance

### If Using Different Filename
Update `src/styles.css`:
```css
background-image: url('./assets/YOUR_FILENAME.ext');
```

---

**The app is waiting for your background image!** 🎨
