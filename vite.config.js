import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  base: "https://topmob.github.io/SmartNotes/",
  plugins: [react()]
})
