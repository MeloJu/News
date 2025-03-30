const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = 3000;

async function scrapeG1() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });

  try {
    console.log('Acessando G1...');
    await page.goto('https://g1.globo.com/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('Esperando conteúdo carregar...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verifica se o elemento específico existe
    const elementoExiste = await page.evaluate(() => {
      return !!document.querySelector('.bstn-hl-title, .feed-post-link');
    });

    if (!elementoExiste) {
      console.log('Elemento principal não encontrado, tentando rolar a página...');
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('Extraindo notícias...');
    const noticias = await page.evaluate(() => {
      const results = [];
      
      // Função para extrair dados de forma segura
      const extractData = (element) => {
        const container = element.closest('.feed-post, .bstn-fd-item, a, [class*="bstn-hl"]') || element;
        return {
          container,
          link: container.href || window.location.href,
          resumo: container.querySelector('.feed-post-body-resumo, .bstn-fd-item-resumo, .bstn-hl-summary, .bstn-h1-summary')?.innerText?.trim() || '',
          imagem: container.querySelector('img')?.src || ''
        };
      };

      // Captura notícias em destaque
      const destaques = document.querySelectorAll('.bstn-hl, .bstn-hl-title, .feed-post-link');
      destaques.forEach(item => {
        const { container, link, resumo, imagem } = extractData(item);
        const titulo = item.innerText.trim();
        
        if (titulo && link) {
          results.push({
            titulo,
            link,
            resumo,
            imagem,
            tipo: 'destaque_principal',
            tag:'G1'
          });
        }
      });

      // Captura outras notícias
      const outrasNoticias = document.querySelectorAll('.feed-post, .bstn-fd-item, [class*="title"]');
      outrasNoticias.forEach(item => {
        const { container, link, resumo, imagem } = extractData(item);
        const titulo = item.innerText.trim();
        
        if (titulo && link && !results.some(noticia => noticia.titulo === titulo)) {
          results.push({
            titulo,
            link,
            resumo,
            imagem,
            tipo: 'comum',
            tag:'G1'
          });
        }
      });

      return results;
    });

    console.log('Notícias capturadas:', noticias.length);
    return noticias;
  } catch (error) {
    console.error('Erro durante scraping:', error);
    throw error;
  } finally {
    await browser.close();
    console.log('Navegador fechado');
  }
}

app.get('/', async (req, res) => {
  try {
    console.log('Iniciando scraping...');
    const noticias = await scrapeG1();
    
    if (noticias.length === 0) {
      console.warn('Nenhuma notícia encontrada');
      return res.status(404).json({ 
        warning: "Nenhuma notícia encontrada",
        suggestion: "A estrutura do site pode ter mudado"
      });
    }
    
    // Filtra para mostrar primeiro a notícia em destaque
    const noticiaDestaque = noticias.find(n => n.tipo === 'destaque_principal');
    res.json({
      noticia_especial: noticiaDestaque,
      outras_noticias: noticias.filter(n => n !== noticiaDestaque)
    });
  } catch (error) {
    console.error('Erro completo:', error);
    res.status(500).json({ 
      error: 'Falha ao buscar notícias',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});