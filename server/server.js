const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Directorios
const PROJECTS_DIR = path.join(__dirname, 'projects');
if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
}

// API Routes

// 1. Proyectos
app.post('/api/projects', (req, res) => {
    const { name } = req.body;
    const projectId = Date.now().toString();
    const projectDir = path.join(PROJECTS_DIR, projectId);
    
    fs.mkdirSync(projectDir);
    
    res.json({
        success: true,
        projectId,
        message: `Proyecto ${name} creado`
    });
});

// 2. Archivos
app.post('/api/files', (req, res) => {
    const { projectId, fileName, content } = req.body;
    const filePath = path.join(PROJECTS_DIR, projectId, fileName);
    
    fs.writeFileSync(filePath, content);
    
    res.json({
        success: true,
        message: `Archivo ${fileName} guardado`
    });
});

// 3. Ejecución de código
app.post('/api/execute', (req, res) => {
    const { language, code } = req.body;
    
    let command;
    switch (language) {
        case 'python':
            command = `python -c "${code.replace(/"/g, '\\"')}"`;
            break;
        case 'javascript':
            command = `node -e "${code.replace(/"/g, '\\"')}"`;
            break;
        case 'go':
            // Para Go necesitaríamos un archivo temporal
            const tempFile = path.join(__dirname, 'temp.go');
            fs.writeFileSync(tempFile, code);
            command = `go run ${tempFile}`;
            break;
        default:
            return res.status(400).json({ error: 'Lenguaje no soportado' });
    }
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            return res.json({ success: false, output: stderr });
        }
        res.json({ success: true, output: stdout });
    });
});

// 4. Extensiones
app.get('/api/extensions', (req, res) => {
    // En una implementación real, esto vendría de una base de datos
    res.json({
        extensions: [
            {
                id: 'vscode-python',
                name: 'Python',
                author: 'Microsoft',
                version: '2023.8.0',
                description: 'Python language support'
            },
            {
                id: 'vscode-go',
                name: 'Go',
                author: 'Google',
                version: '0.35.0',
                description: 'Go language support'
            }
        ]
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
