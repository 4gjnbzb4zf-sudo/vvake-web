import { Inter, JetBrains_Mono, Unbounded } from "next/font/google";

const unbounded = Unbounded({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-unbounded", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jetbrains", display: "swap" });

export const fontVariables = [unbounded.variable, inter.variable, jetbrains.variable].join(" ");
