import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";
import { SHARE_PATH } from "@/lib/share-target";

/** A shortcut icon at the 96 px the spec asks for and 192 px. */
function shortcutIcons(name: string): MetadataRoute.Manifest["icons"] {
  return [96, 192].map((size) => ({
    src: `/brand/png/shortcut-${name}-${size}.png`,
    sizes: `${size}x${size}`,
    type: "image/png",
  }));
}

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.title,
    short_name: brand.name,
    description: brand.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0e17",
    theme_color: "#0a0e17",
    lang: "es",
    categories: ["finance", "productivity"],
    // Android lists the installed app when sharing a photo or a text (plan
    // 3.4); the service worker keeps it and opens Cargar gasto.
    share_target: {
      action: SHARE_PATH,
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [{ name: "image", accept: ["image/*"] }],
      },
    },
    // Long-pressing the installed app's icon on Android (plan 3.11).
    shortcuts: [
      { name: "Cargar gasto", url: "/agregar", icons: shortcutIcons("add") },
      { name: "Foto de ticket", url: "/agregar?foto=1", icons: shortcutIcons("photo") },
      { name: "Comprometido", url: "/tarjetas", icons: shortcutIcons("committed") },
    ],
    icons: [
      { src: "/brand/icons/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/brand/icons/app-icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      { src: "/brand/png/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/png/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/png/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/brand/png/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/brand/png/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
