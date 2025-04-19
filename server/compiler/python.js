// compiler/python.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  /**
   * Ejecuta código Python y devuelve el resultado
   * @param {string} code - Código Python a ejecutar
   * @param {string} [input=''] - Entrada para el programa (opcional)
   * @returns {Promise<Object>} - Promesa que resuelve con {success, output, error}
   */
  executePython: async (code, input = '') => {
    return new Promise((resolve) => {
      try {
        // Crear directorio temporal si no existe
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Crear archivo temporal
        const tempFile = path.join(tempDir, `${uuidv4()}.py`);
        fs.writeFileSync(tempFile, code);

        // Configurar comando
        const command = `python3 ${tempFile}`;

        // Ejecutar el código
        const process = exec(command, (error, stdout, stderr) => {
          // Limpiar archivo temporal
          try {
            fs.unlinkSync(tempFile);
          } catch (cleanError) {
            console.error('Error al limpiar archivo temporal:', cleanError);
          }

          // Manejar resultados
          if (error) {
            resolve({
              success: false,
              output: stderr || error.message
            });
          } else {
            resolve({
              success: true,
              output: stdout
            });
          }
        });

        // Enviar input al proceso si es necesario
        if (input) {
          process.stdin.write(input);
          process.stdin.end();
        }

        // Timeout para evitar procesos colgados
        setTimeout(() => {
          if (!process.killed) {
            process.kill();
            resolve({
              success: false,
              output: 'Error: Tiempo de ejecución excedido (5 segundos)'
            });
          }
        }, 5000);

      } catch (err) {
        resolve({
          success: false,
          output: `Error en el servidor: ${err.message}`
        });
      }
    });
  },

  /**
   * Instala un paquete de Python usando pip
   * @param {string} packageName - Nombre del paquete
   * @returns {Promise<Object>} - Promesa que resuelve con {success, output}
   */
  installPackage: async (packageName) => {
    return new Promise((resolve) => {
      const command = `pip install ${packageName}`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          resolve({
            success: false,
            output: stderr || error.message
          });
        } else {
          resolve({
            success: true,
            output: stdout || `Paquete ${packageName} instalado correctamente`
          });
        }
      });
    });
  },

  /**
   * Analiza el código Python para detectar dependencias
   * @param {string} code - Código Python
   * @returns {Object} - Lista de imports detectados
   */
  analyzeDependencies: (code) => {
    const imports = new Set();
    const lines = code.split('\n');

    // Expresiones regulares para detectar imports
    const importRegex = /^\s*(import|from)\s+([a-zA-Z0-9_]+)/;
    const fromImportRegex = /^\s*from\s+([a-zA-Z0-9_.]+)\s+import/;

    lines.forEach(line => {
      // Ignorar comentarios
      if (line.trim().startsWith('#')) return;

      // Detectar import estándar
      const importMatch = line.match(importRegex);
      if (importMatch) {
        imports.add(importMatch[2].split('.')[0]);
      }

      // Detectar from...import
      const fromMatch = line.match(fromImportRegex);
      if (fromMatch) {
        imports.add(fromMatch[1].split('.')[0]);
      }
    });

    return {
      imports: Array.from(imports).filter(i => !['os', 'sys', 'math'].includes(i))
    };
  },

  /**
   * Linter para código Python
   * @param {string} code - Código Python a analizar
   * @returns {Promise<Object>} - Resultados del análisis
   */
  lintCode: async (code) => {
    return new Promise((resolve) => {
      const tempFile = path.join(__dirname, 'temp', `${uuidv4()}.py`);
      fs.writeFileSync(tempFile, code);

      exec(`pylint ${tempFile} --output-format=json`, (error, stdout) => {
        fs.unlinkSync(tempFile);

        if (error) {
          try {
            const results = JSON.parse(stdout);
            resolve({
              issues: results.map(issue => ({
                line: issue.line,
                column: issue.column,
                message: issue.message,
                severity: issue.type === 'error' ? 'error' : 'warning'
              }))
            });
          } catch (e) {
            resolve({
              issues: [{
                line: 1,
                message: 'Error ejecutando pylint',
                severity: 'error'
              }]
            });
          }
        } else {
          resolve({ issues: [] });
        }
      });
    });
  }
};
