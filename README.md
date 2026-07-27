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

### 🛠️ Tech Stack

KinGraph is built with modern web standards for performance and maintainability:

*   **Frontend:** React (Vite), TypeScript
*   **Styling:** Tailwind CSS (for clean, scalable design)
*   **Visualization:** [React Flow](https://reactflow.dev/) (for the graph engine)
*   **Animations:** Framer Motion (for spring-physics UI effects)
*   **Backend/DB:** Supabase (PostgreSQL + Auth)

### 🚀 Getting Started

To get a local copy up and running, follow these simple steps:

1.  Clone the repo
    ```sh
    git clone https://github.com/your-username/kin-graph.git
    ```
2.  Install NPM packages
    ```sh
    npm install
    ```
3.  Start the development server
    ```sh
    npm run dev
    ```

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
