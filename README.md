# KinGraph 🌳

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) 
[![GitHub Repo stars](https://img.shields.io/github/stars/ch0sn/kin-graph?style=social)]()

**KinGraph** is a modern, open-source genealogy web application designed for the mobile-first era. 

Unlike traditional tools that force you to start with a distant ancestor, KinGraph places **you (the manager)** at the center of your lineage graph. It combines a "classy" aesthetic with smooth animations and powerful visualization tools.

### ✨ Key Features

*   🧭 **Manager-Centric UX:** You are root. The entire family tree is rendered relative to your position, making it intuitive for daily management.
*   📱 **Mobile-First PWA:** Installable on iOS/Android with a responsive layout that feels like a native app.
*   ✨ **Classy & Animated UI:** A modern interface featuring bezier curves, smooth node transitions (via Framer Motion), and elegant typography.
*   🔄 **Dual Views:** Switch seamlessly between a traditional "Vertical Tree" hierarchy or a historical "Horizontal Timeline."
*   🧠 **Smart Logic:** Automatic relationship detection. Adding a sibling automatically links them to your parents; step-relations are handled intuitively.
*   🌍 **Multilingual:** Available in English, German (Deutsch), Spanish (Español) and Korean (한국어), switchable in Settings. Relationship labels follow each language's own conventions, not word-for-word translations: German compounds (*Urgroßmutter*, *Schwiegersohn*), Spanish gender agreement (*tía abuela*, *prima segunda*), and Korean terms that depend on family side, relative age and who is asking (*외할머니*, *이모*, *언니*/*누나*, *사촌*).

### 🛠️ Tech Stack

KinGraph is built with modern web standards for performance and maintainability:

*   **Frontend:** React (Vite), TypeScript
*   **Styling:** Tailwind CSS (for clean, scalable design)
*   **Visualization:** [React Flow](https://reactflow.dev/) (for the graph engine)
*   **Animations:** Framer Motion (for spring-physics UI effects)
*   **Storage:** Local-first. Your tree is saved in your browser (IndexedDB) on your device, nothing is uploaded, and you can export or import JSON backups.

### 🚀 Getting Started

To get a local copy up and running, follow these simple steps:

1.  Clone the repo
    ```sh
    git clone https://github.com/ch0sn/kin-graph.git
    ```
2.  Install NPM packages
    ```sh
    npm install
    ```
3.  Start the development server
    ```sh
    npm run dev
    ```

Run the tests with `npm test`.

### 🌍 Translations

All interface text lives in `src/i18n/`. `en.ts` is the source of truth; every other language (`de.ts`, `es.ts`, `ko.ts`) must translate every key with the same `{placeholders}`, which the compiler and the tests check. Relationship labels are built per language in `src/model/kinship*.ts`. Names and the title "KinGraph" are never translated.

To add a language:

1.  Add a dictionary file in `src/i18n/` typed as `Record<MessageId, string>`.
2.  Register it in `LANGUAGES` and `DICTIONARIES` in `src/i18n/core.ts`.
3.  Add a relationship-label module in `src/model/` and route to it from `describeKinship` in `src/model/kinship.ts`.
4.  Add the language to the tests in `src/i18n/i18n.test.ts` and `src/model/kinship.test.ts`.

### 🎨 Visual Philosophy

KinGraph aims to bridge the gap between raw data and family history. 

*   **Nodes:** We use floating cards with soft shadows rather than rigid flowchart boxes.
*   **Typography:** Serif fonts are used for names (e.g., Playfair Display) to evoke a sense of heritage, while Sans-Serif is used for metadata.
*   **Lines:** Connections are rendered as smooth curves, avoiding sharp geometric angles for a more organic feel.

### 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

### 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---
**KinGraph** © 2026 by Sontek. Released under the MIT License.
