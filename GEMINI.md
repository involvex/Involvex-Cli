# GEMINI.md

## Project Overview

This project is the JavaScript edition of the **InvolveX CLI**, a comprehensive system administration toolkit for Windows. It provides a terminal-based user interface (TUI) for a wide range of system maintenance and administration tasks.

The application is built with **Node.js** and features a modular architecture with distinct services for different functionalities. The TUI is created using the **blessed** library, and command-line argument parsing is handled by **commander**.

### Core Functionalities:

- **Package Management:** Update packages from various managers like Winget, NPM, Scoop, and Chocolatey.
- **System Maintenance:** Clear system caches, manage memory, and handle startup programs.
- **Network Tools:** Perform ping tests, and manage DNS settings.
- **System Administration:** Manage drivers and system restore points.
- **Extensibility:** A plugin system allows for the addition of new features.

## Building and Running

### Prerequisites

- Windows 10/11
- Node.js 16.0 or higher
- Administrator privileges for some operations

### Installation

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```

### Running the Application

- **Interactive Mode:**

  ```bash
  npm start
  ```

  or

  ```bash
  node index.js
  ```

- **Development Mode:**
  ```bash
  npm run dev
  ```

### Testing

- Run all tests:

  ```bash
  npm test
  ```

- Watch for changes and run tests:

  ```bash
  npm run test:watch
  ```

- Generate a coverage report:
  ```bash
  npm run test:coverage
  ```

## Development Conventions

### Linting and Formatting

The project uses **ESLint** for linting and **Prettier** for code formatting.

- **Linting:**

  ```bash
  npm run lint
  ```

- **Auto-fix linting errors:**

  ```bash
  npm run lint:fix
  ```

- **Formatting:**

  ```bash
  npm run format
  ```

- **Check formatting:**
  ```bash
  npm run format:check
  ```

### Contribution Guidelines

1.  Create new services in the `services/` directory.
2.  Implement the required methods for the new functionality.
3.  Integrate the new service into the main menu in `index.js`.
4.  Add or update configuration in `services/ConfigService.js` if necessary.
5.  Ensure all changes are tested and pass the linting and formatting checks.
