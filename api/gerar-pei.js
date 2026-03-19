const { GoogleGenerativeAI } = require('@google/generative-ai');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    const { studentData, laudoBase64, laudoMimeType } = req.body;

    if (!laudoBase64 || !laudoMimeType) {
      return res.status(400).json({ error: 'Laudo não enviado.' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Você é um Especialista em Educação Inclusiva e Atendimento Educacional Especializado (AEE).

Analise o laudo clínico/médico anexo e os dados do aluno. Extraia todas as informações diagnósticas e gere um Plano Educacional Individualizado (PEI) completo e detalhado.

DADOS DO ALUNO (já preenchidos pelo professor):
- Série/Ano: ${studentData.serie || 'não informado'}
- Idade: ${studentData.idade || 'não informado'}
- Turno: ${studentData.turno || 'não informado'}
- Bimestre: ${studentData.bimestre || 'não informado'}

INSTRUÇÕES OBRIGATÓRIAS:
1. Extraia do laudo: diagnósticos, CID(s), recomendações e observações clínicas dos especialistas.
2. Identifique as necessidades educacionais específicas deste aluno.
3. Para cada área, gere metas SMART (Específicas, Mensuráveis, Atingíveis, Relevantes e com Tempo determinado).
4. Transforme termos médicos em estratégias pedagógicas concretas e aplicáveis em sala de aula.
5. Se o laudo citar "Déficit de Atenção", sugira "Fracionamento de atividades e uso de suportes visuais".
6. Se citar "Dislexia", sugira "Uso de texto ampliado, audiobooks e tempo adicional".
7. Foque sempre nas POTENCIALIDADES do aluno, não apenas nas limitações.
8. Sugira tecnologias assistivas específicas para o diagnóstico identificado.

Retorne SOMENTE um JSON válido, sem markdown, sem texto adicional, exatamente nesta estrutura:

{
  "diagnosticos": {
    "parecer_neurologico": "texto completo do parecer neurológico extraído do laudo",
    "parecer_outros": "texto dos outros especialistas (psicólogo, psicopedagogo, fonoaudiólogo, etc.)",
    "cids": ["F70", "G40"],
    "resumo": "resumo diagnóstico em 2-3 linhas focando nas necessidades educacionais"
  },
  "atendimento_especialistas": {
    "descricao": "descrição completa do atendimento especializado recomendado",
    "frequencia": "ex: 2 vezes por semana",
    "modalidades": "AEE, psicopedagogia, fonoaudiologia, etc."
  },
  "potencialidades": "descreva os pontos fortes e habilidades que o aluno demonstra",
  "areas": {
    "cognitiva": {
      "titulo": "Área Cognitiva / Acadêmica",
      "habilidades_atuais": "o que o aluno já consegue fazer nesta área",
      "metas": [
        {
          "descricao": "Meta SMART específica e mensurável",
          "estrategias": ["estratégia pedagógica 1", "estratégia pedagógica 2", "estratégia pedagógica 3"],
          "recursos": ["recurso/material 1", "recurso/material 2"],
          "prazo": "até o final do bimestre"
        }
      ]
    },
    "motora": {
      "titulo": "Área Motora",
      "habilidades_atuais": "o que o aluno já consegue fazer nesta área",
      "metas": [
        {
          "descricao": "Meta SMART específica",
          "estrategias": ["estratégia 1", "estratégia 2"],
          "recursos": ["recurso 1", "recurso 2"],
          "prazo": "até o final do bimestre"
        }
      ]
    },
    "comunicacao": {
      "titulo": "Área de Comunicação e Linguagem",
      "habilidades_atuais": "o que o aluno já consegue fazer nesta área",
      "metas": [
        {
          "descricao": "Meta SMART específica",
          "estrategias": ["estratégia 1", "estratégia 2"],
          "recursos": ["recurso 1", "recurso 2"],
          "prazo": "até o final do bimestre"
        }
      ]
    },
    "social_emocional": {
      "titulo": "Área Social, Emocional e Comportamental",
      "habilidades_atuais": "o que o aluno já consegue fazer nesta área",
      "metas": [
        {
          "descricao": "Meta SMART específica",
          "estrategias": ["estratégia 1", "estratégia 2"],
          "recursos": ["recurso 1", "recurso 2"],
          "prazo": "até o final do bimestre"
        }
      ]
    }
  },
  "adaptacoes_curriculares": [
    "adaptação 1 concreta e aplicável",
    "adaptação 2",
    "adaptação 3",
    "adaptação 4"
  ],
  "tecnologias_assistivas": [
    "tecnologia/recurso assistivo 1 específico para o diagnóstico",
    "tecnologia/recurso assistivo 2",
    "tecnologia/recurso assistivo 3"
  ],
  "orientacoes_familia": "orientações detalhadas para os pais/responsáveis apoiarem o desenvolvimento em casa",
  "avaliacao": "descreva como será avaliado e monitorado o progresso do aluno ao longo do bimestre"
}`;

    const imagePart = {
      inlineData: {
        data: laudoBase64,
        mimeType: laudoMimeType,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text();

    // Remove markdown se presente
    const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let peiData;
    try {
      peiData = JSON.parse(clean);
    } catch {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        peiData = JSON.parse(match[0]);
      } else {
        throw new Error('Não foi possível interpretar a resposta da IA.');
      }
    }

    res.status(200).json({ success: true, pei: peiData });
  } catch (error) {
    console.error('Erro na API:', error);
    res.status(500).json({ error: error.message || 'Erro interno no servidor.' });
  }
};
