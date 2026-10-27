-- =====================================================================
-- SOS ALMOXARIFADO — modelo relacional de REFERÊNCIA
-- =====================================================================
-- Gerado a partir do sistema em produção (Firestore/NoSQL) para servir de
-- ponto de partida ao ERP. Dialeto: PostgreSQL.
--
-- ⚠️ ISTO É UM RASCUNHO PARA DISCUSSÃO, não um esquema final. Ajuste nomes
-- e convenções ao padrão do ERP. O que NÃO deve ser ajustado são os DEFAULTS
-- e as CONSTRAINTS marcadas com [REGRA]: cada uma reproduz uma regra de
-- negócio que custou prejuízo para ser descoberta. Ver, no JSON da
-- especificação, `regras_de_negocio` — o id está citado em cada caso.
-- =====================================================================

-- ---------------------------------------------------------------------
-- EXTENSÕES
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- e-mail sem diferenciar maiúsculas

-- ---------------------------------------------------------------------
-- TIPOS
-- ---------------------------------------------------------------------
CREATE TYPE perfil_usuario AS ENUM ('admin','gerente','almoxarife','franca','compras');

CREATE TYPE status_material AS ENUM
  ('disponivel','em_evento','emprestado','consumido','manutencao','perdido','inativo');

CREATE TYPE status_equipamento AS ENUM
  ('disponivel','em_evento','locacao','sublocado','manutencao','defeito','inativo');

CREATE TYPE status_evento AS ENUM ('ativo','agendado','concluido','encerrado','cancelado');

-- [REGRA ausencia_de_campo_como_valor_padrao] NULL = Evento. É um VALOR, não
-- um dado faltando. Não trocar por 'evento': o sistema atual grava NULL e a
-- migração dos dados depende disso.
CREATE TYPE modalidade_evento AS ENUM ('locacao_mensal','sublocacao');

CREATE TYPE grupo_estoque AS ENUM ('eventos','uso_interno');
CREATE TYPE tipo_ordem_saida AS ENUM ('uso_interno');            -- NULL = saída de evento
CREATE TYPE subtipo_uso_interno AS ENUM ('emprestimo','consumo');
CREATE TYPE status_devolucao_item AS ENUM
  ('ok','problema','cortado','perdido','nao_devolvido','parcial','aguardando');
CREATE TYPE tipo_os AS ENUM ('preventiva','corretiva');
CREATE TYPE local_os AS ENUM ('patio','locacao');
CREATE TYPE status_os AS ENUM ('pendente','em_andamento','concluida');
CREATE TYPE status_compra AS ENUM ('pendente','em_cotacao','comprado','entregue');
CREATE TYPE tipo_termo AS ENUM ('entrega','devolucao');
CREATE TYPE status_termo AS ENUM ('pendente','assinado');
CREATE TYPE tipo_veiculo AS ENUM ('caminhao','carro');

-- ---------------------------------------------------------------------
-- USUÁRIOS E ACESSO
-- ---------------------------------------------------------------------
CREATE TABLE usuario (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL,
  email         citext NOT NULL UNIQUE,
  perfil        perfil_usuario NOT NULL,
  ativo         boolean NOT NULL DEFAULT true,
  criado_em     timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- ESTOQUE DE MATERIAIS
-- ---------------------------------------------------------------------
-- Categoria NÃO é enum: o usuário cria categorias novas em uso.
CREATE TABLE categoria_material (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo    grupo_estoque NOT NULL,
  nome     text NOT NULL,
  UNIQUE (grupo, nome)
);

CREATE TABLE material (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- [REGRA ausencia_de_campo_como_valor_padrao] registro sem grupo = 'eventos'
  grupo          grupo_estoque NOT NULL DEFAULT 'eventos',

  nome           text NOT NULL,
  codigo         text NOT NULL,
  categoria_id   uuid REFERENCES categoria_material(id),
  categoria      text NOT NULL,              -- desnormalizado: o histórico precisa do nome da época
  subcategoria   text,
  tipo           text,
  bitola         text,                       -- usado para agrupar em ESPÉCIE no estoque baixo
  metragem       text,
  numero         text,

  status         status_material NOT NULL DEFAULT 'disponivel',

  -- [REGRA contado_sem_vinculo] material CONTADO nunca preenche este campo.
  -- O vínculo dele com o evento são os itens da ordem de saída, com quantidade.
  evento_id      uuid,   -- FK adicionada no fim do arquivo: `evento` é criada depois

  -- Material de unidade: 1 disponível / 0 fora. Contado: a quantidade real.
  estoque_atual  integer NOT NULL DEFAULT 1,
  estoque_min    integer NOT NULL DEFAULT 0,

  -- [REGRA estoque_tres_naturezas] marcador EXPLÍCITO de material contado.
  -- Vale em qualquer grupo: é assim que o alambrado, material de evento, sai
  -- por quantidade.
  por_quantidade boolean NOT NULL DEFAULT false,

  observacao     text,
  criado_em      timestamptz NOT NULL DEFAULT now(),

  -- [REGRA par_status_estoque] material de unidade disponível NUNCA pode ter
  -- quantidade zero. O sintoma dessa inconsistência é cruel: a tela mostra
  -- "Disponível" e a saída recusa dizendo que não está disponível.
  CONSTRAINT disponivel_tem_estoque CHECK (
    por_quantidade OR status <> 'disponivel' OR estoque_atual > 0
  ),

  -- [REGRA contado_sem_vinculo] reforço no banco
  CONSTRAINT contado_nao_prende_evento CHECK (
    NOT por_quantidade OR evento_id IS NULL
  )
);
CREATE INDEX ON material (status);
CREATE INDEX ON material (evento_id);
CREATE INDEX ON material (grupo, categoria);
CREATE UNIQUE INDEX ON material (codigo);

-- ---------------------------------------------------------------------
-- EVENTOS, LOCAÇÕES E SUBLOCAÇÕES  (mesma tabela, de propósito)
-- ---------------------------------------------------------------------
CREATE TABLE evento (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                 text NOT NULL,          -- na locação, é o nome do cliente
  local                text,

  -- ⚠️ [REGRA data_nao_e_data_do_evento] este é o dia em que a SAÍDA foi
  -- lançada, NÃO o dia do evento. NUNCA derivar cobrança deste campo.
  data_lancamento      date,

  -- [REGRA ausencia_de_campo_como_valor_padrao] NULL = Evento
  modalidade           modalidade_evento,

  status               status_evento NOT NULL DEFAULT 'ativo',

  -- [REGRA data_nao_e_data_do_evento] sem este campo preenchido, NÃO há
  -- cobrança de material atrasado. Só existe no fluxo de Evento.
  previsao_devolucao   date,

  -- Obrigatórios só na sublocação
  retirado_por         text,
  retirado_documento   text,
  retirado_telefone    text,
  empresa_cnpj         text,

  criado_em            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT previsao_so_em_evento CHECK (
    previsao_devolucao IS NULL OR modalidade IS NULL
  ),
  CONSTRAINT sublocacao_exige_dados CHECK (
    modalidade IS DISTINCT FROM 'sublocacao'
    OR (empresa_cnpj IS NOT NULL AND retirado_documento IS NOT NULL AND retirado_telefone IS NOT NULL)
  )
);
CREATE INDEX ON evento (status, modalidade);

-- ---------------------------------------------------------------------
-- ORDENS DE SAÍDA
-- ---------------------------------------------------------------------
CREATE SEQUENCE ordem_saida_numero_seq;

CREATE TABLE ordem_saida (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                   bigint NOT NULL DEFAULT nextval('ordem_saida_numero_seq'),
  numero_formatado         text NOT NULL,          -- OM-AAAA-NNN

  -- [REGRA ausencia_de_campo_como_valor_padrao] NULL = saída de Evento
  tipo                     tipo_ordem_saida,
  subtipo                  subtipo_uso_interno,

  evento_id                uuid REFERENCES evento(id) ON DELETE SET NULL,
  evento_nome              text,                   -- [REGRA historico_desnormalizado]

  responsavel_nome         text,
  observacoes              text,
  previsao_devolucao       date,

  -- uso interno
  data_prevista_devolucao  date,
  destino_motivo           text,
  motivo                   text,
  status_emprestimo        text,

  assinatura_token         uuid,                   -- = id do termo de assinatura
  assinatura_status        text NOT NULL DEFAULT 'pendente',
  qtd_fotos                integer NOT NULL DEFAULT 0,
  status                   text NOT NULL DEFAULT 'ativo',   -- ativo | devolvida

  operador_id              uuid REFERENCES usuario(id),
  operador_nome            text,
  criado_em                timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT subtipo_so_em_uso_interno CHECK (
    (tipo = 'uso_interno') = (subtipo IS NOT NULL)
  )
);
CREATE INDEX ON ordem_saida (evento_id);
CREATE INDEX ON ordem_saida (status, tipo);
CREATE INDEX ON ordem_saida (criado_em);

-- Array `itens` do documento vira tabela filha.
CREATE TABLE ordem_saida_item (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_saida_id  uuid NOT NULL REFERENCES ordem_saida(id) ON DELETE CASCADE,

  -- [REGRA material_apagado_nao_trava_devolucao] a FK precisa sobreviver à
  -- exclusão do material: ON DELETE SET NULL, nunca CASCADE. O item continua
  -- no histórico, marcado como sem cadastro.
  material_id     uuid REFERENCES material(id) ON DELETE SET NULL,

  -- [REGRA historico_desnormalizado] retrato do material na época
  nome            text,
  codigo          text,
  categoria       text,

  -- [REGRA contado_sem_vinculo] para material contado, ESTA é a única prova de
  -- quanto saiu para o evento. Sem ela a devolução não sabe quanto devolver.
  quantidade      integer,

  avulso          boolean NOT NULL DEFAULT false   -- item digitado livre, não mexe em estoque
);
CREATE INDEX ON ordem_saida_item (ordem_saida_id);
CREATE INDEX ON ordem_saida_item (material_id);

CREATE TABLE ordem_saida_equipamento (
  ordem_saida_id  uuid NOT NULL REFERENCES ordem_saida(id) ON DELETE CASCADE,
  equipamento_id  uuid NOT NULL,
  codigo          text,
  PRIMARY KEY (ordem_saida_id, equipamento_id)
);

-- ---------------------------------------------------------------------
-- DEVOLUÇÕES
-- ---------------------------------------------------------------------
CREATE TABLE devolucao (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id     uuid REFERENCES evento(id) ON DELETE SET NULL,
  evento_nome   text,
  parcial       boolean NOT NULL DEFAULT false,  -- item lançado sozinho, sem fechar o evento
  operador_id   uuid REFERENCES usuario(id),
  operador_nome text,
  criado_em     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE devolucao_item (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devolucao_id  uuid NOT NULL REFERENCES devolucao(id) ON DELETE CASCADE,
  material_id   uuid REFERENCES material(id) ON DELETE SET NULL,
  nome          text,
  status        status_devolucao_item NOT NULL,
  descricao     text,

  -- [REGRA material_apagado_nao_trava_devolucao] material excluído do cadastro:
  -- fica registrado, mas não movimenta quantidade (não há registro para mover).
  sem_cadastro  boolean NOT NULL DEFAULT false,

  CONSTRAINT descricao_obrigatoria CHECK (
    status NOT IN ('problema','cortado') OR descricao IS NOT NULL
  )
);

-- ---------------------------------------------------------------------
-- PATRIMÔNIO
-- ---------------------------------------------------------------------
CREATE TABLE gerador (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo              text NOT NULL UNIQUE,   -- GG-NNN. NUNCA reaproveitar, nem de vendido.
  potencia            text,
  marca               text,
  modelo              text,
  motor               text,
  ano                 text,
  status              status_equipamento NOT NULL DEFAULT 'disponivel',
  localizacao         text NOT NULL DEFAULT 'Pátio SOS',

  -- Alguns equipamentos não têm horímetro. Sem o marcador, campo vazio viraria
  -- 0 e falsearia o controle de manutenção.
  sem_horimetro       boolean NOT NULL DEFAULT false,
  horimetro_atual     integer,

  evento_id           uuid REFERENCES evento(id) ON DELETE SET NULL,
  evento_nome         text,
  ultima_manutencao   date,

  -- [REGRA preventiva_alerta] alimenta o alerta automático
  proxima_preventiva  date,

  tem_defeito         boolean NOT NULL DEFAULT false,
  defeito             text,
  ficha_tecnica       jsonb,                  -- dados das placas físicas
  ativo               boolean NOT NULL DEFAULT true,   -- false = vendido
  criado_em           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON gerador (status) WHERE ativo;
CREATE INDEX ON gerador (evento_id);
CREATE INDEX ON gerador (proxima_preventiva) WHERE ativo;

CREATE TABLE veiculo (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                tipo_veiculo NOT NULL DEFAULT 'caminhao',
  placa               text NOT NULL UNIQUE,
  marca               text,
  modelo              text,
  ano                 text,
  status              status_equipamento NOT NULL DEFAULT 'disponivel',
  localizacao         text NOT NULL DEFAULT 'Pátio SOS',
  sem_km              boolean NOT NULL DEFAULT false,
  km_atual            integer,
  proxima_preventiva  date,
  ativo               boolean NOT NULL DEFAULT true,
  criado_em           timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- MANUTENÇÃO
-- ---------------------------------------------------------------------
CREATE SEQUENCE os_numero_seq;

CREATE TABLE ordem_servico (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                text NOT NULL UNIQUE,     -- OS-AAAA-NNN
  equipamento_id        uuid NOT NULL,
  equipamento_tipo      text NOT NULL,            -- gerador | caminhao | empilhadeira
  equipamento_label     text,                     -- [REGRA historico_desnormalizado]
  tipo                  tipo_os NOT NULL,

  -- [REGRA os_em_locacao_nao_volta] com local='locacao' o equipamento NÃO volta
  -- ao pátio: status e localização ficam intactos, o serviço é feito no cliente.
  local_tipo            local_os NOT NULL DEFAULT 'patio',
  cliente_nome          text,
  local_obra            text,

  descricao             text NOT NULL,
  mecanico_id           uuid REFERENCES usuario(id),
  mecanico_nome         text,
  status                status_os NOT NULL DEFAULT 'pendente',
  prioridade            text NOT NULL DEFAULT 'normal',   -- 'maxima' se equipamento em evento ativo
  evento_ativo          boolean NOT NULL DEFAULT false,
  origem                text,                     -- 'saida_filtros' = OS que nasceu com filtros baixados

  horimetro_abertura    integer,
  horimetro_conclusao   integer,
  relatorio_servico     text,
  problemas_encontrados text,
  proxima_preventiva    date,
  assinatura_tecnico    text,                     -- imagem; ver nota sobre storage no README
  assinatura_cliente    text,

  data_abertura         timestamptz NOT NULL DEFAULT now(),
  data_conclusao        timestamptz,

  CONSTRAINT cliente_so_em_locacao CHECK (
    local_tipo = 'locacao' OR cliente_nome IS NULL
  )
);
CREATE INDEX ON ordem_servico (status);
CREATE INDEX ON ordem_servico (equipamento_id);

-- ---------------------------------------------------------------------
-- FILTROS
-- ---------------------------------------------------------------------
CREATE TABLE filtro (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  potencia_gg      text NOT NULL,          -- 30kVA ... 750kVA, Caminhão, Empilhadeira
  tipo             text NOT NULL,

  -- ⚠️ [REGRA filtros_estoque_compartilhado] filtros de potências DIFERENTES
  -- podem ter a mesma referência e compartilham estoque físico. Todo alerta é
  -- agrupado por ESTA coluna, não pelo id.
  referencia       text NOT NULL,

  nome             text NOT NULL,
  fornecedor       text,
  quantidade_atual integer NOT NULL DEFAULT 0,
  estoque_min      integer NOT NULL DEFAULT 1,
  unidade          text NOT NULL DEFAULT 'un',
  validade         date,
  ativo            boolean NOT NULL DEFAULT true
);
CREATE INDEX ON filtro (referencia);

CREATE TABLE entrada_filtro (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filtro_id     uuid NOT NULL REFERENCES filtro(id),
  quantidade    integer NOT NULL CHECK (quantidade > 0),
  nf            text,
  fornecedor    text,
  data_entrada  date NOT NULL,
  validade      date,
  operador_id   uuid REFERENCES usuario(id),
  criado_em     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE baixa_filtro (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filtro_id          uuid REFERENCES filtro(id) ON DELETE SET NULL,
  filtro_nome        text,
  potencia_gg        text,
  quantidade         integer NOT NULL CHECK (quantidade > 0),
  motivo             text,
  ordem_servico_id   uuid REFERENCES ordem_servico(id) ON DELETE SET NULL,
  operador_id        uuid REFERENCES usuario(id),
  criado_em          timestamptz NOT NULL DEFAULT now()
);
-- Base do cálculo de ruptura (consumo de 60 dias) e de consumo anormal
CREATE INDEX ON baixa_filtro (criado_em);
CREATE INDEX ON baixa_filtro (filtro_id, criado_em);

-- ---------------------------------------------------------------------
-- COMPRAS
-- ---------------------------------------------------------------------
CREATE TABLE solicitacao_compra (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                 text,
  item_id              uuid,
  item_nome            text NOT NULL,
  referencia           text,
  fornecedor           text,
  quantidade_atual     integer,
  estoque_min          integer,
  quantidade_sugerida  integer,
  urgente              boolean NOT NULL DEFAULT false,
  status               status_compra NOT NULL DEFAULT 'pendente',
  valor                numeric(12,2),
  data_entrega         date,
  criado_em            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON solicitacao_compra (status);

-- ---------------------------------------------------------------------
-- DOCUMENTOS ASSINADOS  (acesso público por token — ver README)
-- ---------------------------------------------------------------------
CREATE TABLE assinatura_saida (
  token                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_saida_id        uuid NOT NULL REFERENCES ordem_saida(id) ON DELETE CASCADE,
  numero_formatado      text,
  evento_nome           text,
  local                 text,
  data_evento           date,
  itens                 jsonb NOT NULL,     -- retrato congelado: é o que foi assinado
  entregou_nome         text,
  entregou_assinatura   text,
  recebeu_nome          text,
  recebeu_assinatura    text,

  -- [REGRA assinatura_nunca_trava] 'pendente' é estado NORMAL e não impede a
  -- saída do material. O link cobra a regularização depois.
  status                status_termo NOT NULL DEFAULT 'pendente',
  criado_em             timestamptz NOT NULL DEFAULT now(),
  assinado_em           timestamptz
);

CREATE TABLE termo_locacao (
  token               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                tipo_termo NOT NULL,
  evento_id           uuid NOT NULL REFERENCES evento(id) ON DELETE CASCADE,
  evento_nome         text,
  local               text,
  data_evento         date,
  numero_formatado    text,

  -- ⚠️ IMUTÁVEL depois de assinado: é esta lista que as duas partes assinaram.
  itens               jsonb NOT NULL,
  equipamentos        jsonb,

  sos_nome            text,
  sos_assinatura      text,       -- entrega: pré-preenchida; devolução: colhida no local
  cliente_nome        text,
  cliente_documento   text,       -- CPF na entrega, RG na devolução
  cliente_assinatura  text,

  -- [REGRA termo_devolucao_exige_resposta] mapa item -> 'ok' | 'faltou'.
  -- Na devolução, TODO item precisa de resposta antes de assinar.
  conferencia         jsonb,
  faltantes           jsonb,

  observacoes         text,
  qtd_fotos           integer NOT NULL DEFAULT 0,
  status              status_termo NOT NULL DEFAULT 'pendente',
  criado_em           timestamptz NOT NULL DEFAULT now(),
  assinado_em         timestamptz
);
CREATE INDEX ON termo_locacao (evento_id);

-- ---------------------------------------------------------------------
-- ANEXOS
-- ---------------------------------------------------------------------
-- No sistema atual a imagem é base64 num registro próprio, por limite de 1 MB
-- por documento do Firestore. Num ERP com storage de arquivos, trocar `dados`
-- por `url`. A ASSINATURA, porém, deve continuar recuperável junto do
-- documento: ela é prova.
CREATE TABLE anexo (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade       text NOT NULL,      -- ordem_saida | ordem_servico | termo_locacao | solicitacao
  entidade_id    uuid NOT NULL,
  momento        text,               -- saida | devolucao
  ordem          integer NOT NULL DEFAULT 0,
  url            text,
  dados          text,               -- base64 (legado da migração)
  criado_por     uuid REFERENCES usuario(id),
  criado_em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON anexo (entidade, entidade_id);

-- ---------------------------------------------------------------------
-- CHAVES ESTRANGEIRAS ADIADAS (dependência circular material <-> evento)
-- ---------------------------------------------------------------------
ALTER TABLE material
  ADD CONSTRAINT material_evento_fk
  FOREIGN KEY (evento_id) REFERENCES evento(id) ON DELETE SET NULL;

-- =====================================================================
-- NOTAS DE IMPLEMENTAÇÃO
-- =====================================================================
-- 1. [REGRA confirmacao_idempotente] A gravação de uma saída tem três etapas
--    (anexos → transação de estoque → documento de assinatura). A rede do
--    galpão cai. Gere o ID da ordem ANTES de começar e torne a operação
--    repetível: se a ordem já existe, não refazer a baixa de estoque. Sem
--    isso, o segundo toque no botão cria ordem duplicada e queima estoque.
--
-- 2. Toda movimentação de estoque roda em UMA transação, com bloqueio das
--    linhas de material lidas (SELECT ... FOR UPDATE).
--
-- 3. [REGRA estoque_baixo_por_especie] NÃO existe coluna "estoque baixo". É
--    cálculo, e tem duas regras diferentes que não podem ser unificadas:
--    material de unidade agrupa por espécie (categoria + bitola) e CABO NUNCA
--    alerta; consumível usa quantidade_atual <= estoque_min. A implementação
--    de referência está em `02-regras-executaveis/estoqueEspecie.js`.
--
-- 4. Os links públicos de assinatura e termo precisam continuar existindo: o
--    cliente e o colaborador em campo assinam SEM login, pelo token. A regra
--    de acesso está em `04-controle-de-acesso/firestore.rules` — leitura
--    pública pelo token, escrita anônima UMA vez (pendente → assinado), e a
--    lista de itens assinada não pode ser alterada.
-- =====================================================================
