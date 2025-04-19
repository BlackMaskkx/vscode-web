document.addEventListener('DOMContentLoaded', function() {
    // Configuración inicial
    const editor = ace.edit("code-editor");
    editor.setTheme("ace/theme/dracula");
    editor.session.setMode("ace/mode/javascript");
    editor.setOptions({
        fontSize: "14px",
        enableBasicAutocompletion: true,
        enableLiveAutocompletion: true,
        enableSnippets: true
    });

    // Variables de estado
    let currentProject = {
        name: "Untitled Project",
        files: [],
        settings: {
            theme: "dark",
            fontSize: 14,
            tabSize: 4
        }
    };

    let openFiles = [];
    let activeFile = null;
    let extensions = [];

    // Elementos del DOM
    const fileTree = document.getElementById("file-tree");
    const editorTabs = document.getElementById("editor-tabs");
    const terminalOutput = document.getElementById("terminal-output");
    const terminalCommand = document.getElementById("terminal-command");
    const cursorPositionElement = document.getElementById("cursor-position");
    const themeSelector = document.getElementById("theme-selector");
    const languageSelector = document.getElementById("language-selector");
    const extensionsList = document.getElementById("extensions-list");
    const extensionModal = document.getElementById("extension-modal");

    // Inicializar el IDE
    initIDE();

    // Funciones principales
    function initIDE() {
        setupEventListeners();
        loadDefaultExtensions();
        updateUI();
    }

    function setupEventListeners() {
        // Activity Bar
        document.querySelectorAll(".activity-item").forEach(item => {
            item.addEventListener("click", function() {
                document.querySelectorAll(".activity-item").forEach(i => i.classList.remove("active"));
                this.classList.add("active");
                
                const view = this.getAttribute("data-view");
                document.querySelectorAll(".sidebar-content").forEach(content => {
                    content.classList.add("hidden");
                });
                document.getElementById(`${view}-view`).classList.remove("hidden");
            });
        });

        // Terminal
        terminalCommand.addEventListener("keydown", function(e) {
            if (e.key === "Enter") {
                executeCommand(this.value);
                this.value = "";
            }
        });

        document.getElementById("clear-terminal").addEventListener("click", function() {
            terminalOutput.innerHTML = "";
        });

        // Editor
        editor.session.on("changeCursorPosition", function(e) {
            cursorPositionElement.textContent = `Ln ${e.cursor.row + 1}, Col ${e.cursor.column + 1}`;
        });

        // Configuración
        themeSelector.addEventListener("change", function() {
            currentProject.settings.theme = this.value;
            updateTheme();
        });

        languageSelector.addEventListener("change", function() {
            if (activeFile) {
                const mode = getLanguageMode(this.value);
                editor.session.setMode(mode);
            }
        });

        // Extensiones
        document.querySelectorAll(".close-modal").forEach(btn => {
            btn.addEventListener("click", function() {
                extensionModal.classList.remove("active");
            });
        });

        document.getElementById("install-extension").addEventListener("click", function() {
            const extensionId = this.getAttribute("data-extension-id");
            installExtension(extensionId);
        });
    }

    function updateUI() {
        updateTheme();
        updateFileTree();
    }

    function updateTheme() {
        const theme = currentProject.settings.theme;
        document.body.className = theme === "light" ? "light-theme" : "";
        
        const editorTheme = theme === "light" ? "ace/theme/chrome" : "ace/theme/dracula";
        editor.setTheme(editorTheme);
    }

    function updateFileTree() {
        fileTree.innerHTML = "";
        
        if (!currentProject.files.length) {
            const emptyMsg = document.createElement("div");
            emptyMsg.className = "tree-item";
            emptyMsg.textContent = "No hay archivos en el proyecto";
            fileTree.appendChild(emptyMsg);
            return;
        }

        // Implementar lógica para mostrar la estructura de archivos
        // Esto es un ejemplo simplificado
        currentProject.files.forEach(file => {
            const fileItem = document.createElement("div");
            fileItem.className = "tree-item file";
            fileItem.textContent = file.name;
            fileItem.addEventListener("click", () => openFile(file));
            fileTree.appendChild(fileItem);
        });
    }

    function openFile(file) {
        // Verificar si el archivo ya está abierto
        const existingTab = openFiles.find(f => f.id === file.id);
        
        if (existingTab) {
            setActiveFile(existingTab);
            return;
        }

        // Crear nueva pestaña
        const tab = document.createElement("div");
        tab.className = "tab active";
        tab.textContent = file.name;
        tab.dataset.fileId = file.id;

        const closeBtn = document.createElement("span");
        closeBtn.className = "tab-close";
        closeBtn.innerHTML = "&times;";
        closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            closeFile(file.id);
        });

        tab.appendChild(closeBtn);
        editorTabs.appendChild(tab);

        // Agregar a archivos abiertos
        openFiles.push(file);
        setActiveFile(file);

        // Configurar editor
        editor.setValue(file.content || "", -1);
        const mode = getLanguageMode(file.language || "text");
        editor.session.setMode(mode);
    }

    function setActiveFile(file) {
        // Desactivar todas las pestañas
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        
        // Activar la pestaña seleccionada
        const tab = document.querySelector(`.tab[data-file-id="${file.id}"]`);
        if (tab) tab.classList.add("active");
        
        activeFile = file;
        
        // Actualizar editor
        editor.setValue(file.content || "", -1);
        const mode = getLanguageMode(file.language || "text");
        editor.session.setMode(mode);
    }

    function closeFile(fileId) {
        // Guardar cambios
        saveCurrentFile();
        
        // Eliminar pestaña
        const tab = document.querySelector(`.tab[data-file-id="${fileId}"]`);
        if (tab) tab.remove();
        
        // Eliminar de archivos abiertos
        openFiles = openFiles.filter(f => f.id !== fileId);
        
        // Activar otra pestaña si hay
        if (openFiles.length > 0) {
            setActiveFile(openFiles[openFiles.length - 1]);
        } else {
            activeFile = null;
            editor.setValue("", -1);
        }
    }

    function saveCurrentFile() {
        if (!activeFile) return;
        
        // Actualizar contenido en memoria
        activeFile.content = editor.getValue();
        
        // Actualizar en el proyecto
        const projectFile = currentProject.files.find(f => f.id === activeFile.id);
        if (projectFile) {
            projectFile.content = activeFile.content;
        }
        
        logToTerminal(`Archivo guardado: ${activeFile.name}`);
    }

    function executeCommand(command) {
        logToTerminal(`> ${command}`);
        
        // Ejecutar comando (simulado)
        setTimeout(() => {
            if (command.startsWith("run")) {
                runCurrentFile();
            } else {
                logToTerminal("Comando no reconocido");
            }
        }, 500);
    }

    function runCurrentFile() {
        if (!activeFile) {
            logToTerminal("Error: No hay archivo abierto", "error");
            return;
        }
        
        logToTerminal(`Ejecutando ${activeFile.name}...`);
        
        // Simular ejecución (en un caso real harías una petición al backend)
        setTimeout(() => {
            switch (activeFile.language) {
                case "javascript":
                    logToTerminal("Hello World from JavaScript!");
                    break;
                case "python":
                    logToTerminal("Hello World from Python!");
                    break;
                case "go":
                    logToTerminal("Hello World from Go!");
                    break;
                default:
                    logToTerminal("Lenguaje no soportado para ejecución", "error");
            }
        }, 1000);
    }

    function logToTerminal(message, type = "info") {
        const line = document.createElement("div");
        line.textContent = message;
        
        switch (type) {
            case "error":
                line.style.color = "#f14c4c";
                break;
            case "success":
                line.style.color = "#0dbc79";
                break;
            case "warning":
                line.style.color = "#cca700";
                break;
            default:
                line.style.color = "#cccccc";
        }
        
        terminalOutput.appendChild(line);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }

    function getLanguageMode(language) {
        switch (language) {
            case "javascript": return "ace/mode/javascript";
            case "python": return "ace/mode/python";
            case "go": return "ace/mode/golang";
            case "php": return "ace/mode/php";
            case "ruby": return "ace/mode/ruby";
            case "java": return "ace/mode/java";
            case "kotlin": return "ace/mode/kotlin";
            case "html": return "ace/mode/html";
            case "css": return "ace/mode/css";
            case "json": return "ace/mode/json";
            default: return "ace/mode/text";
        }
    }

    function loadDefaultExtensions() {
        // Extensiones preinstaladas
        extensions = [
            {
                id: "vscode-python",
                name: "Python",
                author: "Microsoft",
                version: "2023.8.0",
                description: "Extension for Python language support",
                installed: true
            },
            {
                id: "vscode-go",
                name: "Go",
                author: "Google",
                version: "0.35.0",
                description: "Extension for Go language support",
                installed: true
            },
            {
                id: "vscode-php",
                name: "PHP",
                author: "DEVSENSE",
                version: "1.25.0",
                description: "Extension for PHP language support",
                installed: false
            },
            {
                id: "vscode-ruby",
                name: "Ruby",
                author: "Shopify",
                version: "0.28.0",
                description: "Extension for Ruby language support",
                installed: false
            }
        ];

        updateExtensionsList();
    }

    function updateExtensionsList() {
        extensionsList.innerHTML = "";
        
        extensions.forEach(ext => {
            const extCard = document.createElement("div");
            extCard.className = "extension-card";
            extCard.innerHTML = `
                <div class="extension-name">${ext.name}</div>
                <div class="extension-description">${ext.description}</div>
                <div class="extension-status">${ext.installed ? "Instalada" : "No instalada"}</div>
            `;
            
            extCard.addEventListener("click", () => showExtensionDetails(ext));
            extensionsList.appendChild(extCard);
        });
    }

    function showExtensionDetails(extension) {
        document.getElementById("extension-modal-title").textContent = extension.name;
        document.getElementById("extension-author").textContent = `por ${extension.author}`;
        document.getElementById("extension-version").textContent = `versión ${extension.version}`;
        document.getElementById("extension-desc").textContent = extension.description;
        
        const installBtn = document.getElementById("install-extension");
        installBtn.textContent = extension.installed ? "Desinstalar" : "Instalar";
        installBtn.setAttribute("data-extension-id", extension.id);
        
        extensionModal.classList.add("active");
    }

    function installExtension(extensionId) {
        const extension = extensions.find(ext => ext.id === extensionId);
        if (!extension) return;
        
        extension.installed = !extension.installed;
        updateExtensionsList();
        
        logToTerminal(`Extensión ${extension.name} ${extension.installed ? "instalada" : "desinstalada"}`);
        extensionModal.classList.remove("active");
    }

    // Archivos de ejemplo para demostración
    currentProject.files = [
        {
            id: "file1",
            name: "main.js",
            language: "javascript",
            content: "console.log('Hello World!');"
        },
        {
            id: "file2",
            name: "app.py",
            language: "python",
            content: "print('Hello World!')"
        },
        {
            id: "file3",
            name: "main.go",
            language: "go",
            content: "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfmt.Println(\"Hello World!\")\n}"
        }
    ];

    // Abrir el primer archivo por defecto
    if (currentProject.files.length > 0) {
        openFile(currentProject.files[0]);
    }
});
