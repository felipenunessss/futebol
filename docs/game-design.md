# Game Design — Simulador de Carreira de Futebol
### (Copero + Brasfoot + Pro Clubs, com foco em imersão regional brasileira)

---

## 1. Visão Geral

Um simulador de carreira de jogador de futebol inspirado no **Copero.net**, mas com três diferenciais centrais:

1. **Sistema de evolução baseado em XP de desempenho**, não em "roubar" atributos de lendas.
2. **Imersão profunda em campeonatos regionais e estaduais brasileiros** (Paulistão, Carioca, Mineiro, Gaúcho, etc.), tratados como parte central da jornada, não como preenchimento de calendário.
3. **Mix de mecânicas de evolução** entre três referências:
   - **Copero** → XP por desempenho real em campo, jornada narrativa de carreira.
   - **Brasfoot** → profundidade de gestão: mercado de transferências, negociação, finanças de clube, database realista.
   - **Pro Clubs** → arquétipos por posição, progressão em níveis, perks desbloqueáveis, builds com identidade.

Database ampla: clubes reais das primeiras e segundas divisões de ~50-60 países do futebol mundial (Europa toda, América do Sul toda, principais da América do Norte/África/Ásia), com todas as nacionalidades disponíveis para criação de jogador.

---

## 2. Estrutura de Calendário e Estaduais

### 2.1 Calendário mestre

O motor de simulação sabe, semana a semana, quais competições estão ativas:

```json
{
  "temporada": 2027,
  "calendario_mestre": [
    {"periodo": "jan-1a_quinz", "competicoes_ativas": ["estaduais_fase_grupos"]},
    {"periodo": "fev", "competicoes_ativas": ["estaduais_fase_grupos", "copa_do_brasil_1a_fase"]},
    {"periodo": "mar", "competicoes_ativas": ["estaduais_mata_mata", "libertadores_fase_grupos"]},
    {"periodo": "abr", "competicoes_ativas": ["estaduais_final", "copa_do_brasil_2a_fase"]},
    {"periodo": "mai-nov", "competicoes_ativas": ["brasileirao_serie_a", "copa_do_brasil", "libertadores_ou_sulamericana"]}
  ]
}
```

### 2.2 Modelo de dados: Campeonato Estadual

Estrutura modular — cada estado ativa só os blocos de formato que usa de verdade (Paulistão com quadrangular, Gauchão só grupos + mata-mata, Carioca com Taça Guanabara/Rio, etc.):

```json
{
  "campeonato_estadual": {
    "id": "paulistao_a1",
    "nome": "Campeonato Paulista - Série A1",
    "estado": "SP",
    "nivel": 1,
    "ano_referencia": 2027,
    "formato": {
      "fase_grupos": {
        "num_grupos": 4,
        "times_por_grupo": 4,
        "ida_e_volta": false,
        "classificam_por_grupo": 2
      },
      "fase_quadrangular": {
        "ativa": true,
        "num_grupos": 2,
        "times_por_grupo": 4,
        "classificam_por_grupo": 2
      },
      "mata_mata": {
        "fases": ["semifinal", "final"],
        "ida_e_volta": true
      }
    },
    "premiacao": {
      "vaga_copa_do_brasil": 4,
      "vaga_libertadores": 1,
      "rebaixamento_proxima_divisao": 2
    },
    "classicos": [
      {"time_a": "corinthians", "time_b": "palmeiras", "nome": "Derby Paulista", "peso_midia": 5},
      {"time_a": "sao_paulo", "time_b": "santos", "nome": "Clássico da Vovó", "peso_midia": 4},
      {"time_a": "corinthians", "time_b": "sao_paulo", "nome": "Majestoso", "peso_midia": 4}
    ],
    "times": ["corinthians", "palmeiras", "sao_paulo", "santos", "..."]
  }
}
```

### 2.3 Elementos de imersão nos estaduais

- Clássicos regionais com **peso próprio** (multiplicador de moral/mídia diferente de jogo normal).
- Times menores do interior que existem só nos estaduais — permite começar a carreira numa divisão estadual inferior antes de subir.
- Rebaixamento/acesso dentro da própria estrutura estadual (ex: segunda divisão do Paulistão).

---

## 3. Sistema de Evolução do Jogador

### 3.1 Geração de XP (base Copero)

- XP anual/por temporada gerado por: minutos jogados, notas de desempenho por partida, gols/assistências relativos à posição, metas cumpridas (ex: "seja artilheiro do estadual").
- Picos de forma e idade influenciam o ganho: jogador jovem ganha XP mais rápido; veterano ganha menos, mas acumula "XP de experiência" (bônus mentais/liderança).
- Escolhas de treino semanal consomem XP de forma direcionada (treinar finalização vs. resistência é uma decisão real).

### 3.2 Arquétipos por posição (base Pro Clubs)

Em vez de atributos genéricos soltos, cada posição tem **builds** com foco diferente, que direcionam onde o XP rende mais:

```json
{
  "posicao": "atacante",
  "arquetipos": [
    {
      "id": "finalizador",
      "nome": "Finalizador",
      "stats_prioritarios": ["finalizacao", "posicionamento_ofensivo", "frieza"],
      "perks_exclusivos": ["Voleio Letal", "Bico Preciso", "Faro de Gol"]
    },
    {
      "id": "pivo",
      "nome": "Pivô de Área",
      "stats_prioritarios": ["jogo_aereo", "forca_fisica", "protecao_de_bola"],
      "perks_exclusivos": ["Cabeceio de Zagueiro", "Domínio de Costas", "Segura e Espera"]
    },
    {
      "id": "ponta_velocista",
      "nome": "Ponta Velocista",
      "stats_prioritarios": ["velocidade", "drible", "cruzamento"],
      "perks_exclusivos": ["Explosão em Corrida", "Corte Seco", "Cruzamento de Linha de Fundo"]
    },
    {
      "id": "falso_9",
      "nome": "Falso 9",
      "stats_prioritarios": ["visao_de_jogo", "passe_curto", "movimentacao"],
      "perks_exclusivos": ["Troca de Posição", "Passe entre Linhas", "Chegada Atrasada"]
    }
  ]
}
```

Cada posição (goleiro, zagueiro, lateral, volante, meia, atacante) deve ter de 3 a 4 arquétipos equivalentes — a definir em detalhe na próxima etapa.

### 3.3 Progressão em níveis com perks

```json
{
  "sistema_nivel": {
    "nivel_max": 99,
    "xp_por_nivel": "curva_exponencial_leve",
    "slots_de_perk": [
      {"nivel": 10, "slots_liberados": 1},
      {"nivel": 25, "slots_liberados": 1},
      {"nivel": 45, "slots_liberados": 1},
      {"nivel": 70, "slots_liberados": 1},
      {"nivel": 99, "slots_liberados": 1, "perk_lendario": true}
    ],
    "respec": {
      "permitido": true,
      "custo": "moeda_do_jogo ou 1x por temporada gratis"
    }
  }
}
```

O XP vem de desempenho real (Copero), mas se converte em **nível do jogador + escolha de perk** dentro do arquétipo (Pro Clubs) — em vez de virar um número solto num atributo isolado.

---

## 4. Camada de Mercado e Gestão (base Brasfoot)

- **Motor de valorização de mercado**: valor de mercado sobe com base em nível + perks + desempenho nos estaduais/nacional.
- **Negociação ativa**: ao receber proposta, o jogador negocia salário, luvas, cláusula de rescisão, tempo de contrato — com barra de "confiança do clube", não apenas aceitar/recusar.
- **Janelas de transferência reais** (verão europeu, janela brasileira), encaixadas no calendário mestre.
- **Cenário financeiro do clube** limita o teto salarial disponível — clube pequeno de estadual não pode bancar salário de clube grande, criando barreiras realistas de progressão.

```json
{
  "negociacao": {
    "clube_ofertante": "gremio",
    "proposta_inicial": {"salario": 45000, "luvas": 200000, "anos": 3},
    "contraproposta_jogador": {"salario": 60000, "clausula_rescisao": 15000000},
    "fatores_confianca": ["nivel_atual", "perks_relevantes_pro_esquema_tatico", "desempenho_recente", "concorrencia_de_outros_clubes"]
  }
}
```

---

## 5. Pilares de Imersão

### 5.1 Narrativa de carreira
- Lesões com risco realista ligado à carga de jogos (estaduais apertados aumentam o risco).
- Imprensa regional: manchetes de jornais locais após clássicos, pressão da torcida do estádio.
- Dilemas de carreira: aceitar proposta de clube grande no meio do estadual ou terminar o campeonato por lealdade/moral.
- Rivalidades pessoais com outros jogadores (duelos diretos em clássicos).

### 5.2 Profundidade tática e técnica
- Posições e sub-funções (ex: lateral que ataca vs. que marca) mudam quais XPs são mais úteis.
- Estilos de jogo do técnico afetam quais atributos rendem XP mais rápido.
- Sessões de treino semanais com escolha de foco (físico, técnico, tático, descanso).
- Condicionamento físico e fadiga acumulada ao longo da temporada de estaduais + nacional.

### 5.3 Vida fora de campo
- Reputação separada por região (ídolo local no estadual x desconhecido fora do estado).
- Patrocínios regionais vs. nacionais, desbloqueados por desempenho e mídia.
- Relações com elenco, comissão técnica e diretoria (afeta minutagem e renovações).
- Vida pessoal: família, mudanças de cidade ao trocar de clube, impacto no moral.

---

## 6. Ciclo de Jogo (Game Loop)

```
Jogar partidas (estadual/nacional)
        ↓
Gerar XP real por desempenho
        ↓
Subir de nível
        ↓
Escolher perk dentro do arquétipo da posição
        ↓
Valorizar no mercado (Brasfoot)
        ↓
Negociar transferência (peso de clube/estadual/finanças)
        ↓
Repetir em clube maior / competição maior
```

---

## 7. Escopo de Database

- Clubes reais das primeiras e segundas divisões de ~50-60 principais países do futebol mundial:
  - Europa completa
  - América do Sul completa
  - Principais países da América do Norte, África e Ásia
- Todas as nacionalidades disponíveis para criação de jogador.
- Cobertura especial e detalhada dos campeonatos estaduais brasileiros (formatos, clássicos, times de divisões inferiores).

---

## 8. Próximos Passos de Modelagem

1. Detalhar arquétipos das posições restantes (goleiro, zagueiro, lateral, volante, meia).
2. Modelar o motor de simulação de partidas (como nível + perks + tática decidem o resultado).
3. Popular a database de estaduais e clubes.
4. Definir estrutura de projeto e ordem de implementação no Claude Code:
   - Fase 1: dados (estaduais + clubes)
   - Fase 2: motor de simulação de partida
   - Fase 3: sistema de progressão do jogador
   - Fase 4: camada de mercado/transferências
   - Fase 5: interface
