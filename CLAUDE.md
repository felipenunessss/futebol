# futebol-carreira

Simulador de carreira de futebol (base Copero + Brasfoot + Pro Clubs), com foco em imersão nos campeonatos estaduais e nacionais brasileiros. Design completo em `docs/game-design.md`.

## Instrução permanente

**Sempre que você fizer um `git commit`, rode `git push` logo em seguida, automaticamente, sem esperar o usuário pedir.** Só pule o push se o próprio usuário disser explicitamente para não empurrar ainda.

## Stack

- TypeScript (Node, ESM) — sem framework de UI ainda, só motor/dados/CLI.
- Testes: Vitest (`npm test`).
- Execução: `tsx` (`npm run dev`, ou `npx tsx <arquivo>.ts` pra scripts avulsos).
- Build: `npm run build` (`tsc`).
- `gh` CLI já autenticado nesta máquina (conta `felipenunessss`); remote `origin` aponta pra `https://github.com/felipenunessss/futebol.git`.

## Estrutura de pastas

```
docs/
  game-design.md          — design doc original do jogo (seção 3 superada, ver motor-de-partida.md)
  motor-de-partida.md     — design do motor de partida e progressão do jogador (Fase 2/3): rating tipo Elo, duelo por zona, atributos sem perks
  dados-a-verificar.md    — pendências/ressalvas de dados (leia antes de confiar em algo "meio certo")
  regras-competicoes.md   — decisões de regra de jogo (não de dado) pendentes de implementação na Fase 2

src/
  schemas/                — tipos TS (Club, CampeonatoEstadual, CampeonatoNacional, Player, etc.)
  data/
    clubes/               — clubes reais do Brasil, um arquivo por âmbito:
                             brasil.json = clubes com presença em competição nacional (Série A-D)
                             <uf>_estadual.json = clubes que só jogam o estadual daquele estado
    estaduais/             — campeonatos estaduais, um arquivo por divisão
                             (ex: paulistao_a1.json, mineiro_2.json, cearense_1.json)
    campeonatos-nacionais/ — Brasileirão Séries A-D, Copa do Brasil, copas regionais
    loaders/               — funções para carregar/validar os dados acima (index.ts) e
                             lógica de resolução de vagas (vagas-nacionais.ts, gerar-copa-regional.ts)
  simulation/  — motor de simulação de partida (Fase 2), rating tipo Elo, calendário de competições
  progression/ — XP/atributos sem perks, arquétipos, curvas de idade, cenários de carreira com gatilho
  market/      — mercado de transferências (Fase 4 adiantada): valorização, propostas, negociação
  career/      — estado de carreira (Player.ts), patrocínios, game loop persistente (career-loop.ts)
  cli/         — CLI fina pra exercitar o motor

scripts/
  gerar-copas-regionais.ts — gera Copa do Nordeste/Verde/Sul-Sudeste a partir de clubes já cadastrados
  seed-data.ts             — stub, ainda não implementado

tests/data/    — testes de integridade dos dados (referências, ids únicos, consistência de divisao_nacional)

export/        — snapshot consolidado (JSON + CSV) de clubes/estaduais/nacionais, gerado a partir de src/data/,
                 não é fonte de verdade — regenerar manualmente quando necessário (não há script pra isso ainda)
```

## Onde estão os dados (resumo rápido)

- **Todos os 27 estados + DF** têm pelo menos a 1ª divisão do estadual modelada. SP, RJ, MG, RS, BA, PE têm 2+ divisões.
- **Brasileirão Séries A/B/C** têm elenco real completo (20 clubes cada, temporada 2026). **Série D** tem 76 de 96 reais confirmados.
- **Copa do Brasil** tem os 60 clubes de alta confiança (Série A/B/C); o resto depende de vagas estaduais/ranking não totalmente pesquisadas.
- **Copa do Nordeste, Copa Verde, Copa Sul-Sudeste**: geradas por script (`scripts/gerar-copas-regionais.ts`), não escritas à mão — reaproveitam 100% clubes já cadastrados.
- Campo `divisao_nacional` no `Club` indica em qual série nacional (se houver) o clube joga — é a fonte de verdade pra saber se um clube "já está em competição nacional".
- **Antes de confiar em qualquer dado "no limite"** (fundação, estádio, critério exato de vaga, formato de mata-mata), consulte `docs/dados-a-verificar.md` — tem bastante coisa documentada como aproximação ou pendência.

## Convenções ao mexer nos dados

- Nunca invente clube ou fato que não consiga confirmar por fonte — documente como pendência em `docs/dados-a-verificar.md` em vez de assumir.
- Ao adicionar/mudar clubes ou campeonatos, rode `npm test` e `npx tsc --noEmit` antes de comitar.
- Prefira gerar dados por script (como as copas regionais) a escrever JSON estático à mão quando a lista de participantes pode ser derivada de clubes que já existem na base.
