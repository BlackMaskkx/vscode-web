// server/extensions/extension-manager.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const axios = require('axios');

// Configuración
const EXTENSIONS_DIR = path.join(__dirname, '../../extensions');
const EXTENSION_REGISTRY = 'https://your-extension-registry.com/api'; // Cambiar por tu registro

// Crear directorio si no existe
if (!fs.existsSync(EXTENSIONS_DIR)) {
    fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });
}

module.exports = {
    /**
     * Instala una extensión desde el registro
     * @param {string} extensionId - ID de la extensión (ej: "ms-python.python")
     * @returns {Promise<Object>} - Resultado de la instalación
     */
    installExtension: async (extensionId) => {
        try {
            // 1. Verificar si ya está instalada
            const installed = await this.getInstalledExtensions();
            if (installed.some(ext => ext.id === extensionId)) {
                return { success: false, message: 'La extensión ya está instalada' };
            }

            // 2. Obtener metadata de la extensión
            const response = await axios.get(`${EXTENSION_REGISTRY}/extensions/${extensionId}`);
            const extensionData = response.data;

            // 3. Crear directorio para la extensión
            const extDir = path.join(EXTENSIONS_DIR, extensionId);
            fs.mkdirSync(extDir);

            // 4. Descargar y extraer la extensión
            const downloadUrl = extensionData.downloadUrl;
            const downloadPath = path.join(extDir, 'extension.vsix');
            
            await this._downloadFile(downloadUrl, downloadPath);
            execSync(`unzip ${downloadPath} -d ${extDir}`);
            fs.unlinkSync(downloadPath);

            // 5. Guardar metadata
            fs.writeFileSync(
                path.join(extDir, 'package.json'),
                JSON.stringify({
                    id: extensionId,
                    name: extensionData.name,
                    version: extensionData.version,
                    publisher: extensionData.publisher,
                    description: extensionData.description,
                    installed: true,
                    active: true
                }, null, 2)
            );

            // 6. Instalar dependencias si es necesario
            if (extensionData.requires) {
                this._installDependencies(extensionData.requires);
            }

            return { 
                success: true, 
                message: `Extensión ${extensionData.name} instalada correctamente` 
            };
        } catch (error) {
            return { 
                success: false, 
                message: `Error instalando extensión: ${error.message}` 
            };
        }
    },

    /**
     * Desinstala una extensión
     * @param {string} extensionId - ID de la extensión
     * @returns {Promise<Object>} - Resultado de la desinstalación
     */
    uninstallExtension: async (extensionId) => {
        try {
            const extDir = path.join(EXTENSIONS_DIR, extensionId);
            
            if (!fs.existsSync(extDir)) {
                return { success: false, message: 'Extensión no encontrada' };
            }

            // Eliminar directorio recursivamente
            fs.rmSync(extDir, { recursive: true, force: true });

            return { 
                success: true, 
                message: `Extensión ${extensionId} desinstalada correctamente` 
            };
        } catch (error) {
            return { 
                success: false, 
                message: `Error desinstalando extensión: ${error.message}` 
            };
        }
    },

    /**
     * Activa/desactiva una extensión
     * @param {string} extensionId - ID de la extensión
     * @param {boolean} active - Estado deseado
     * @returns {Promise<Object>} - Resultado de la operación
     */
    setExtensionActive: async (extensionId, active) => {
        try {
            const extDir = path.join(EXTENSIONS_DIR, extensionId);
            const packagePath = path.join(extDir, 'package.json');

            if (!fs.existsSync(packagePath)) {
                return { success: false, message: 'Extensión no encontrada' };
            }

            const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
            packageData.active = active;

            fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2));

            return { 
                success: true, 
                message: `Extensión ${extensionId} ${active ? 'activada' : 'desactivada'}` 
            };
        } catch (error) {
            return { 
                success: false, 
                message: `Error actualizando extensión: ${error.message}` 
            };
        }
    },

    /**
     * Obtiene la lista de extensiones instaladas
     * @returns {Promise<Array>} - Lista de extensiones
     */
    getInstalledExtensions: async () => {
        try {
            const extensions = [];
            const dirs = fs.readdirSync(EXTENSIONS_DIR);

            for (const dir of dirs) {
                const packagePath = path.join(EXTENSIONS_DIR, dir, 'package.json');
                if (fs.existsSync(packagePath)) {
                    const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
                    extensions.push(packageData);
                }
            }

            return extensions;
        } catch (error) {
            console.error('Error leyendo extensiones:', error);
            return [];
        }
    },

    /**
     * Busca extensiones en el registro
     * @param {string} query - Término de búsqueda
     * @returns {Promise<Array>} - Resultados de búsqueda
     */
    searchExtensions: async (query) => {
        try {
            const response = await axios.get(`${EXTENSION_REGISTRY}/search?q=${query}`);
            return response.data;
        } catch (error) {
            console.error('Error buscando extensiones:', error);
            return [];
        }
    },

    // ===== MÉTODOS PRIVADOS ===== //

    /**
     * Descarga un archivo desde una URL
     * @private
     */
    _downloadFile: async (url, outputPath) => {
        const writer = fs.createWriteStream(outputPath);
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    },

    /**
     * Instala dependencias de la extensión
     * @private
     */
    _installDependencies: (requires) => {
        if (requires.python) {
            console.log('Instalando dependencias Python:', requires.python);
            execSync(`pip install ${requires.python.join(' ')}`);
        }

        if (requires.node) {
            console.log('Instalando dependencias Node:', requires.node);
            execSync(`npm install ${requires.node.join(' ')} --prefix ${EXTENSIONS_DIR}`);
        }
    }
};
