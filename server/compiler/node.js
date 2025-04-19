// compiler/node.js
const { exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const vm = require('vm');

module.exports = {
    /**
     * Ejecuta código JavaScript/Node.js
     * @param {string} code - Código a ejecutar
     * @param {string} [type='module'] - Tipo de módulo ('module' o 'commonjs')
     * @returns {Promise<{success: boolean, output: string, error: string}>}
     */
    executeNode: async (code, type = 'module') => {
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFile = path.join(tempDir, `${uuidv4()}.${type === 'module' ? 'mjs' : 'js'}`);
        const packageFile = path.join(tempDir, 'package.json');

        try {
            // Escribir el archivo temporal
            fs.writeFileSync(tempFile, code);

            // Configurar package.json si es módulo
            if (type === 'module') {
                fs.writeFileSync(packageFile, JSON.stringify({ type: 'module' }));
            }

            // Ejecutar el código
            return new Promise((resolve) => {
                const command = `node ${tempFile}`;
                const child = exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
                    // Limpieza
                    fs.unlinkSync(tempFile);
                    if (fs.existsSync(packageFile)) fs.unlinkSync(packageFile);

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
                error: err.stack
            };
        }
    },

    /**
     * Ejecuta código en un sandbox seguro
     * @param {string} code - Código a ejecutar
     * @param {Object} [context={}] - Contexto global disponible
     * @returns {Promise<{success: boolean, output: any, error: string}>}
     */
    executeInSandbox: async (code, context = {}) => {
        return new Promise((resolve) => {
            try {
                const sandbox = {
                    console: {
                        log: (...args) => {
                            sandbox.__output__ += args.join(' ') + '\n';
                        }
                    },
                    __output__: '',
                    ...context
                };

                vm.createContext(sandbox);
                vm.runInContext(code, sandbox, { timeout: 1000 });

                resolve({
                    success: true,
                    output: sandbox.__output__,
                    error: null
                });
            } catch (err) {
                resolve({
                    success: false,
                    output: '',
                    error: err.message
                });
            }
        });
    },

    /**
     * Instala dependencias NPM
     * @param {string[]} packages - Paquetes a instalar
     * @param {string} [version='latest'] - Versión a instalar
     * @returns {Promise<{success: boolean, output: string}>}
     */
    installDependencies: async (packages, version = 'latest') => {
        try {
            const tempDir = path.join(__dirname, 'temp_projects');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            const projectId = uuidv4();
            const projectDir = path.join(tempDir, projectId);
            fs.mkdirSync(projectDir);

            // Crear package.json básico
            fs.writeFileSync(
                path.join(projectDir, 'package.json'),
                JSON.stringify({
                    name: `temp-project-${projectId}`,
                    version: '1.0.0',
                    private: true
                })
            );

            // Instalar paquetes
            const packagesWithVersion = packages.map(pkg => 
                version === 'latest' ? pkg : `${pkg}@${version}`
            );

            const installCmd = `npm install ${packagesWithVersion.join(' ')}`;
            const output = execSync(installCmd, { 
                cwd: projectDir,
                stdio: 'pipe',
                timeout: 60000 
            }).toString();

            // Limpiar (en producción podrías mantenerlo para caché)
            fs.rmSync(projectDir, { recursive: true, force: true });

            return {
                success: true,
                output: output
            };
        } catch (err) {
            return {
                success: false,
                output: err.stderr ? err.stderr.toString() : err.message
            };
        }
    },

    /**
     * Analiza dependencias del código
     * @param {string} code - Código a analizar
     * @returns {Object} - Dependencias encontradas
     */
    analyzeDependencies: (code) => {
        const requires = new Set();
        const imports = new Set();

        // Detectar require()
        const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
        let match;
        while ((match = requireRegex.exec(code)) !== null) {
            const dep = match[1].split('/')[0]; // Tomar solo el nombre principal
            if (!dep.startsWith('.')) { // Ignorar imports locales
                requires.add(dep);
            }
        }

        // Detectar import/export
        const importRegex = /(?:import|export)(?:\s+[\w*{}\n\r\t, ]+from\s+)?['"]([^'"]+)['"]/g;
        while ((match = importRegex.exec(code)) !== null) {
            const dep = match[1].split('/')[0];
            if (!dep.startsWith('.')) {
                imports.add(dep);
            }
        }

        // Filtrar módulos nativos de Node
        const builtins = new Set(require('module').builtinModules);
        const externalDeps = [...requires].filter(dep => !builtins.has(dep));
        const externalImports = [...imports].filter(dep => !builtins.has(dep));

        return {
            requires: externalDeps,
            imports: externalImports,
            allDependencies: [...new Set([...externalDeps, ...externalImports])]
        };
    },

    /**
     * Ejecuta tests con Jest
     * @param {string} code - Código del test
     * @param {string} [testCode=''] - Código de prueba (opcional)
     * @returns {Promise<{success: boolean, output: string}>}
     */
    runTests: async (code, testCode = '') => {
        const tempDir = path.join(__dirname, 'temp_tests');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const testId = uuidv4();
        const testFile = path.join(tempDir, `${testId}.test.js`);

        try {
            // Combinar código y tests
            const fullCode = `${code}\n\n${testCode}`;
            fs.writeFileSync(testFile, fullCode);

            // Configurar Jest
            const jestConfig = {
                testMatch: [testFile],
                verbose: true,
                displayName: 'Tests',
                testEnvironment: 'node',
                reporters: [
                    ['default', { summaryThreshold: 0 }]
                ]
            };

            const configFile = path.join(tempDir, 'jest.config.json');
            fs.writeFileSync(configFile, JSON.stringify(jestConfig));

            // Ejecutar Jest
            const output = execSync(`npx jest --config ${configFile}`, {
                stdio: 'pipe',
                timeout: 10000
            }).toString();

            // Limpiar
            fs.unlinkSync(testFile);
            fs.unlinkSync(configFile);

            return {
                success: true,
                output: output
            };
        } catch (err) {
            return {
                success: false,
                output: err.stderr ? err.stderr.toString() : err.message
            };
        }
    }
};
