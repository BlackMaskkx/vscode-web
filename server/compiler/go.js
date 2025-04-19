// compiler/go.js
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

module.exports = {
    /**
     * Ejecuta código Go (compila y ejecuta)
     * @param {string} code - Código Go a ejecutar
     * @param {Object} [options={}] - Opciones adicionales
     * @returns {Promise<{success: boolean, output: string, error: string}>}
     */
    executeGo: async (code, options = {}) => {
        const tempDir = path.join(__dirname, 'temp_go');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const goFile = path.join(tempDir, `${uuidv4()}.go`);
        const executable = path.join(tempDir, `exec_${uuidv4()}`);

        try {
            // Escribir el archivo temporal
            fs.writeFileSync(goFile, code);

            // Compilar
            const compileCmd = `go build -o ${executable} ${goFile}`;
            execSync(compileCmd, { timeout: 10000 });

            // Ejecutar
            return new Promise((resolve) => {
                const child = exec(executable, { timeout: 5000 }, (error, stdout, stderr) => {
                    // Limpieza
                    fs.unlinkSync(goFile);
                    fs.unlinkSync(executable);

                    if (error) {
                        resolve({
                            success: false,
                            output: stderr || error.message,
                            error: error.stack
                        });
                    } else {
                        resolve({
                            success: true,
                            output: stdout,
                            error: null
                        });
                    }
                });

                // Timeout de seguridad
                setTimeout(() => {
                    if (!child.killed) {
                        child.kill();
                        resolve({
                            success: false,
                            output: 'Error: Tiempo de ejecución excedido (5 segundos)',
                            error: 'TIMEOUT'
                        });
                    }
                }, 5000);
            });
        } catch (err) {
            return {
                success: false,
                output: `Error en el servidor: ${err.message}`,
                error: err.stderr ? err.stderr.toString() : err.stack
            };
        }
    },

    /**
     * Ejecuta código Go directamente con 'go run'
     * (Más lento pero no deja binarios)
     * @param {string} code - Código Go a ejecutar
     * @returns {Promise<{success: boolean, output: string}>}
     */
    runGo: async (code) => {
        const tempDir = path.join(__dirname, 'temp_go_run');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const goFile = path.join(tempDir, `${uuidv4()}.go`);

        try {
            fs.writeFileSync(goFile, code);
            const output = execSync(`go run ${goFile}`, { 
                timeout: 10000,
                stdio: 'pipe'
            }).toString();

            fs.unlinkSync(goFile);
            return { success: true, output };
        } catch (err) {
            return {
                success: false,
                output: err.stderr ? err.stderr.toString() : err.message
            };
        }
    },

    /**
     * Obtiene información del entorno Go
     * @returns {Object} - Versión y módulos instalados
     */
    getGoEnv: () => {
        try {
            const version = execSync('go version').toString().trim();
            const modules = execSync('go list -m all').toString().split('\n').filter(Boolean);
            
            return {
                success: true,
                version,
                modules
            };
        } catch (err) {
            return {
                success: false,
                error: err.message
            };
        }
    },

    /**
     * Añade un módulo Go
     * @param {string} modulePath - Ruta del módulo (ej: "github.com/gorilla/mux")
     * @returns {Promise<{success: boolean, output: string}>}
     */
    addModule: async (modulePath) => {
        try {
            const output = execSync(`go get ${modulePath}`, { 
                timeout: 30000,
                stdio: 'pipe'
            }).toString();

            return {
                success: true,
                output
            };
        } catch (err) {
            return {
                success: false,
                output: err.stderr ? err.stderr.toString() : err.message
            };
        }
    },

    /**
     * Analiza dependencias en código Go
     * @param {string} code - Código a analizar
     * @returns {Object} - Módulos importados
     */
    analyzeDependencies: (code) => {
        const imports = new Set();
        const importRegex = /import\s*(?:\(\s*([^)]+)\s*\)|"([^"]+)")/g;
        const lines = code.split('\n');

        // Análisis de imports agrupados
        let inMultiLineImport = false;
        let currentImports = [];

        for (const line of lines) {
            const trimmedLine = line.trim();

            if (trimmedLine.startsWith('import (')) {
                inMultiLineImport = true;
                continue;
            }

            if (inMultiLineImport && trimmedLine === ')') {
                inMultiLineImport = false;
                currentImports.forEach(imp => imports.add(imp));
                currentImports = [];
                continue;
            }

            if (inMultiLineImport) {
                const match = trimmedLine.match(/^"([^"]+)"|^\w+\s+"([^"]+)"/);
                if (match) {
                    currentImports.push(match[1] || match[2]);
                }
                continue;
            }

            // Análisis de imports simples
            const singleLineMatch = trimmedLine.match(/^import\s+"([^"]+)"/);
            if (singleLineMatch) {
                imports.add(singleLineMatch[1]);
            }
        }

        // Filtrar stdlib
        const stdlib = new Set([
            'fmt', 'io', 'math', 'os', 'strconv', 'strings', 
            'time', 'errors', 'bufio', 'log', 'encoding/json'
        ]);

        const externalDeps = [...imports].filter(imp => {
            return !stdlib.has(imp) && 
                   !imp.startsWith('.') && 
                   !imp.startsWith('internal/');
        });

        return {
            allImports: [...imports],
            externalDeps
        };
    },

    /**
     * Ejecuta tests Go
     * @param {string} code - Código con tests
     * @returns {Promise<{success: boolean, output: string}>}
     */
    runGoTests: async (code) => {
        const tempDir = path.join(__dirname, 'temp_go_tests');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const testFile = path.join(tempDir, `${uuidv4()}_test.go`);

        try {
            fs.writeFileSync(testFile, code);
            const output = execSync(`go test -v ${testFile}`, { 
                timeout: 15000,
                stdio: 'pipe'
            }).toString();

            fs.unlinkSync(testFile);
            return { success: true, output };
        } catch (err) {
            return {
                success: false,
                output: err.stderr ? err.stderr.toString() : err.message
            };
        }
    },

    /**
     * Formatea código Go con gofmt
     * @param {string} code - Código a formatear
     * @returns {Promise<{success: boolean, formatted: string, error: string}>}
     */
    formatGoCode: async (code) => {
        const tempDir = path.join(__dirname, 'temp_go_fmt');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const goFile = path.join(tempDir, `${uuidv4()}.go`);

        try {
            fs.writeFileSync(goFile, code);
            const formatted = execSync(`gofmt ${goFile}`, { 
                stdio: 'pipe'
            }).toString();

            fs.unlinkSync(goFile);
            return { success: true, formatted };
        } catch (err) {
            return {
                success: false,
                formatted: code,
                error: err.stderr ? err.stderr.toString() : err.message
            };
        }
    }
};
