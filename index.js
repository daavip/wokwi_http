const express = require('express');
const swaggerUi = require('swagger-ui-express');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));
// ==========================================
// Configuração do Documento Swagger (OpenAPI)
// ==========================================
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'API de Sensores Edge Computing - ESP32',
    version: '2.0.0',
    description: 'API atualizada para receber dados processados na borda (Edge Computing) com temperatura, humidade e eventos.',
  },
  servers: [
    {
      url: '/',
      description: 'Servidor Atual'
    }
  ],
  paths: {
    '/api/leituras': {
      get: {
        summary: 'Lista todas as leituras e alertas',
        description: 'Retorna o histórico de eventos recebidos do ESP32.',
        responses: {
          '200': {
            description: 'Lista recuperada com sucesso',
          }
        }
      },
      post: {
        summary: 'Salva uma nova leitura ou evento',
        description: 'Recebe os dados do ESP32 no formato JSON e guarda na base de dados.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  device_id: { type: 'string', example: 'esp32-01' },
                  timestamp: { type: 'integer', example: 1708819200 },
                  temperatura: { type: 'number', example: 32.50 },
                  umidade: { type: 'number', example: 55.20 },
                  evento: { type: 'string', example: 'temperatura_alta' }
                }
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Dados guardados com sucesso'
          },
          '400': {
            description: 'Dados obrigatórios em falta'
          }
        }
      }
    }
  }
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ==========================================
// Configuração da Base de Dados SQLite
// ==========================================
let db;

async function inicializarBanco() {
    // Usamos um novo ficheiro (_v2) para que o SQLite crie a tabela do zero 
    // com as novas colunas, sem entrar em conflito com os testes antigos.
    db = await open({
        filename: './dados_sensores_v2.db', 
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS leituras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT,
            timestamp INTEGER,
            temperatura REAL,
            umidade REAL,
            evento TEXT,
            recebido_em TEXT
        )
    `);
    console.log('📦 Base de dados SQLite (v2) inicializada com sucesso!');
}
inicializarBanco(); 

// ==========================================
// Rotas da API 
// ==========================================

app.post('/api/leituras', async (req, res) => {
    // Agora extraímos as novas chaves enviadas pelo ESP32
    const { device_id, timestamp, temperatura, umidade, evento } = req.body;

    if (!device_id || timestamp === undefined) {
        return res.status(400).json({ error: 'Faltam dados obrigatórios no JSON' });
    }

    const recebido_em = new Date().toISOString();

    try {
        const resultado = await db.run(
            `INSERT INTO leituras (device_id, timestamp, temperatura, umidade, evento, recebido_em) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [device_id, timestamp, temperatura, umidade, evento, recebido_em]
        );

        const novaLeitura = {
            id: resultado.lastID, 
            device_id,
            timestamp,
            temperatura,
            umidade,
            evento,
            recebido_em
        };

        console.log('⚡ Novo evento guardado:', novaLeitura);
        res.status(201).json({ message: 'Dados guardados com sucesso!', data: novaLeitura });
        
    } catch (erro) {
        console.error('Erro ao guardar na base de dados:', erro);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

app.get('/api/leituras', async (req, res) => {
    try {
        const leituras = await db.all('SELECT * FROM leituras ORDER BY id DESC');
        res.status(200).json(leituras);
    } catch (erro) {
        console.error('Erro ao consultar a base de dados:', erro);
        res.status(500).json({ error: 'Erro interno ao procurar os dados.' });
    }
});

// ==========================================
// Inicialização do Servidor
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 Servidor a correr em http://localhost:${PORT}`);
    console.log(`📄 Documentação do Swagger em http://localhost:${PORT}/api-docs`);
});
