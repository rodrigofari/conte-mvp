# Co.nTe Agro

Protótipo funcional de uma plataforma de inteligência agrícola para a Madeira. Interface em português de Portugal, inspirada nos mockups fornecidos, com mapa real e dados agrícolas inteiramente fictícios.

## Executar

Requer Node.js 22.17+ e npm.

```sh
npm install
npm run dev
```

Abra o endereço indicado pelo Vite (normalmente http://localhost:5173).

```sh
npm run build    # TypeScript e bundle de produção
npm run preview # servir o bundle compilado
npm test        # testes de geometria, importação e simulação
```

## Percurso demonstrativo

Uma organização pode ter vários terrenos e explorações. **Cada terreno pode acolher várias explorações e uma exploração pode abranger vários terrenos**, com limites próprios em cada local. As parcelas e os sensores identificam simultaneamente a exploração e o terreno.

1. Com o perfil Administrador, abra **Terrenos → Novo terreno**. Dê um nome ao terreno e desenhe o perímetro no mapa, terminando com **Concluir**.
2. Use **Desenhar exploração** para delimitar uma área dentro do terreno. No seletor **Criar ou associar exploração**, crie uma exploração com nome/responsável/organização ou associe uma exploração existente a este terreno. A associação mantém o mesmo identificador e não duplica dados de outros terrenos. As áreas de explorações no mesmo terreno não podem sobrepor-se.
3. Use **Ajustar limites** na lista de terrenos. Arraste os círculos maiores para mover vértices ou os pontos intermédios para acrescentar um canto. **Redesenhar terreno** permite substituir o contorno. Quando uma exploração ocupava exatamente todo o terreno, o respetivo contorno acompanha a alteração; parcelas e áreas de explorações independentes que fiquem fora continuam a impedir a alteração, com uma mensagem identificando o que precisa de ajuste.
4. Clique em **Guardar terreno**. Em cada exploração, use **Culturas e sensores** para abrir o seu detalhe e depois **Editar no mapa**.
5. No seletor **Terreno selecionado**, escolha o terreno da exploração que pretende editar; o mapa centra-se nesse local. Use **Parcela** para desenhar áreas de cultivo dentro dos limites dessa exploração, indicando nome, cultura e variedade.
6. Use **Sensor**, selecione o equipamento e clique no mapa. O sensor pertence à exploração em edição; a associação à parcela é calculada apenas entre as parcelas dessa exploração. Não é associado à parcela de uma exploração vizinha.
7. Guarde a exploração. Os seus gráficos, sensores e culturas são independentes dos restantes ocupantes do terreno.

Os terrenos podem ter áreas livres e podem ser guardados antes de adicionar explorações. O percurso anterior **Nova exploração**, que cria uma exploração com um novo terreno, continua disponível. O respetivo formulário também permite seguir para um terreno existente.

Ao carregar dados anteriores, a aplicação associa cada exploração ao seu terreno e mantém geometrias, parcelas e sensores. A primeira migração guarda uma cópia dos dados antigos em `conte-agro-v1-backup`; o estado ativo continua na chave `conte-agro-v1`, com versão de esquema 2. A ligação legada `Land.farmId` é mantida para compatibilidade com explorações antigas que tinham vários terrenos; novas explorações referenciam `Farm.landId` e têm a sua própria geometria. As parcelas identificam explicitamente `farmId`.

No telemóvel, use o menu para abrir os filtros e toque no mapa para marcar vértices. O formulário aparece abaixo do mapa. Todos os perfis continuam demonstrativos; na página Terrenos, agricultores e empresas podem editar os terrenos das suas explorações. Um perímetro partilhado com explorações de outras organizações é gerido pelo Administrador; Município e Investigador têm uma visão de consulta.

## Funcionalidades

- Oito páginas navegáveis: Mapa, Terrenos, Explorações, Sensores, Estações, Alertas, Analytics e Parceiros.
- MapLibre GL JS com satélite Esri World Imagery e mapa OpenStreetMap, zoom, pan, clusters e camadas comutáveis.
- Explorações, terrenos e parcelas GeoJSON; sensores com localização, métricas específicas, estado e associação espacial.
- Três explorações demonstrativas: vinha em Câmara de Lobos, dois apiários na Ribeira Brava e pomares na Calheta.
- Histórico determinístico de 30 dias, gráficos de 24 horas/7 dias/30 dias, atualização manual e automática (30 segundos de tempo real avançam uma hora simulada).
- Pesquisa e filtros por localização, cultura, organização, tipo de sensor e estado. Estatísticas derivadas do estado visível.
- Alertas demonstrativos de humidade, temperatura, precipitação e comunicação. Limites ajustáveis durante a sessão.
- Exportação/importação de um FeatureCollection GeoJSON com propriedades `entity` e identificadores de associação. A importação substitui os dados após confirmação e valida as geometrias/relações.
- Cinco perfis de visibilidade simulada e opção de repor os dados iniciais em Parceiros.
- Meteorologia externa opcional através de Open-Meteo, separada das medições simuladas e identificada com fonte/hora. Uma falha do serviço não impede o uso da aplicação.

## Organização técnica

- `src/model.ts`: entidades, dados iniciais, cálculo/validação espacial, histórico, persistência e GeoJSON.
- `src/MapView.tsx`: mapa, camadas, agrupamentos, desenho e arrasto de vértices/marcadores.
- `src/components.tsx`: gráficos, métricas, formulários e modais reutilizáveis.
- `src/Terrains.tsx`: gestão de terrenos partilhados, desenho e edição de explorações independentes.
- `src/App.tsx`: navegação, filtros, editor e páginas da demonstração.
- `src/services.ts`: interfaces `DeviceProvider`/`WeatherProvider`, simulador e adaptador Open-Meteo.
- `src/styles.css`: identidade visual e adaptação a desktop, tablet e telemóvel.

O editor usa eventos e marcadores do MapLibre, com validação Turf, sem dependência de um serviço externo de desenho. Os workers do MapLibre são empacotados pelo Vite.

## Limitações e fontes externas

Não existe backend, autenticação, controlo de acesso real, sincronização entre dispositivos nem ligação a hardware. Os perfis apenas alteram a visibilidade na interface. Não utilizar dados pessoais reais. Os dados, geometrias e alertas são demonstrativos, não recomendações agronómicas validadas.

O armazenamento está limitado a este navegador. Exporte o GeoJSON para conservar uma cópia. A importação espera o esquema Co.nTe exportado pela aplicação; não é um importador universal de ficheiros GIS. O editor suporta polígonos simples, sem buracos e sem MultiPolygon nesta versão. As organizações são as três entidades fictícias iniciais.

Cartografia e meteorologia requerem ligação à Internet. As atribuições cartográficas são apresentadas no mapa. Esta demonstração usa [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9) e os tiles públicos [OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/); o uso publicado ou de maior escala deve respeitar os termos e capacidade dos fornecedores. [Open-Meteo](https://open-meteo.com/en/terms) fornece dados sob CC BY 4.0 e disponibiliza a API gratuita para uso não comercial; os valores externos são previsões/modelos, não medições de sensores Co.nTe. Não existe ligação ativa ao IPMA.

As interfaces dos serviços permitem introduzir fornecedores reais de dispositivos e meteorologia; autenticação, APIs persistentes, autorização, telemetria, administração de organizações e políticas de partilha serão trabalho de uma fase posterior.

## Testes no navegador

```sh
npx playwright install chromium
npm run test:e2e
```

A configuração inicia automaticamente um servidor Vite na porta 5175. Se preferir o Chrome já instalado, use `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`.

Os testes cobrem criação de terreno/três parcelas/sensor, associação espacial, gravação e refresh, navegação, pesquisa, filtros, perfis, largura móvel, edição de vértices e posição de sensores, confirmação de eliminação, exportação/importação e falha controlada da meteorologia externa. Os screenshots ficam em `.context/`.

Os testes adicionais verificam migração idempotente, explorações contidas no terreno e sem sobreposições, isolamento de sensores/parcelas entre explorações vizinhas e exportação/importação da nova hierarquia.

As áreas adicionais de uma exploração são guardadas em `Farm.additionalLands`, com `landId` e geometria próprios. A área total soma as áreas ocupadas em todos os terrenos. Retirar uma exploração de um terreno não elimina os restantes terrenos dessa exploração. O GeoJSON mantém estas relações.
