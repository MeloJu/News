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
    // Método compatível com versões antigas para espera
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verifica se o elemento específico existe
    const elementoExiste = await page.evaluate(() => {
      return !!document.querySelector('.bstn-hl-title');
    });

    if (!elementoExiste) {
      console.log('Elemento .bstn-hl-title não encontrado, tentando rolar a página...');
      // Rola a página para carregar conteúdo dinâmico
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('Extraindo notícias...');
    const noticias = await page.evaluate(() => {
      const results = [];
      
      // Captura específica para a notícia desejada
      const tituloDestaque = document.querySelector('.bstn-hl-title');
      if (tituloDestaque) {
        const container = tituloDestaque.closest('a') || tituloDestaque.closest('[class*="bstn-hl"]');
        if (container) {
          results.push({
            titulo: tituloDestaque.innerText.trim(),
            link: container.href || window.location.href,
            tipo: 'destaque_principal'
          });
        }
      }

      // Captura outras notícias
      document.querySelectorAll('.feed-post-link, .bstn-fd-item-title, [class*="title"]').forEach(item => {
        const link = item.closest('a')?.href;
        if (link && item.innerText.trim()) {
          // Evita duplicatas
          if (!results.some(noticia => noticia.titulo === item.innerText.trim())) {
            results.push({
              titulo: item.innerText.trim(),
              link: link,
              tipo: 'comum'
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
    const noticias = await scrapeG1();
    
    if (noticias.length === 0) {
      console.warn('Nenhuma notícia encontrada');
      return res.status(404).json({ 
        warning: "Nenhuma notícia encontrada",
        suggestion: "A estrutura do site pode ter mudado"
      });
    }
    
    // Filtra para mostrar primeiro a notícia específica da página
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