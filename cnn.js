const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = 3001;

async function scrapeCNN() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });

  try {
    console.log('Acessando CNN...');
    await page.goto('https://www.cnnbrasil.com.br/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('Esperando conteúdo carregar...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('Extraindo notícias...');
    const noticias = await page.evaluate(() => {
      const results = [];
      
      // Função para extrair a URL da imagem
      const getImageUrl = (element) => {
        const imgElement = element.querySelector('img') || 
                         element.querySelector('picture source') ||
                         element.querySelector('[data-src]');
        
        return imgElement?.src || 
               imgElement?.dataset?.src || 
               imgElement?.getAttribute('data-src') ||
               null;
      };

      // Captura específica para a notícia desejada
      const tituloDestaque = document.querySelector('.block__news__title');
      if (tituloDestaque) {
        const container = tituloDestaque.closest('a') || tituloDestaque.closest('[class*="bstn-hl"]');
        if (container) {
          results.push({
            titulo: tituloDestaque.innerText.trim(),
            link: container.href || window.location.href,
            imagem: getImageUrl(container),
            tipo: 'destaque_principal',
            tag: 'CNN', 
            language: 'Portuguese'
          });
        }
      }

      // Captura outras notícias
      document.querySelectorAll('.block__news__related, .block__news__item, [class*="title"]').forEach(item => {
        const container = item.closest('article, .news-item, a') || item;
        const link = container.href;
        
        if (link && item.innerText.trim()) {
          // Evita duplicatas
          if (!results.some(noticia => noticia.titulo === item.innerText.trim())) {
            results.push({
              titulo: item.innerText.trim(),
              link: link,
              imagem: getImageUrl(container),
              tipo: 'comum',
              tag: 'CNN',
              language: 'Portuguese'
            });
          }
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
    const noticias = await scrapeCNN();
    
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