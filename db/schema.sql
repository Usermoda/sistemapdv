-- Schema do Sistema PDV
-- Convertido para UTF-8 / InnoDB / utf8mb4

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;
SET sql_mode = '';

CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_aliquota` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `aliquota` varchar(50) default NULL,
  `porcentagem` DOUBLE default NULL,
  `cod_tributacao` DOUBLE default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_aliquota_tributacao` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `cod_tributacao` DOUBLE NOT NULL default '0.0000',
  `tributacao` varchar(100) NOT NULL default '',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
LOCK TABLES `cad_aliquota_tributacao` WRITE;
/*!40000 ALTER TABLE `cad_aliquota_tributacao` DISABLE KEYS*/;
INSERT IGNORE INTO `cad_aliquota_tributacao` (`id`, `cod_tributacao`, `tributacao`) VALUES
	('1','0','0 - Tributada integralmente'),
	('2','1','1 - Tributada e com cobrança do ICMS por substituição tributária'),
	('3','2','2 - Com redução de base de cálculo'),
	('4','3','3 - Isenta ou não tributada e com cobrança do ICMS por substituição tributária'),
	('5','4','4.0 - Isenta'),
	('6','4','4.1 - Não tributada'),
	('7','5','5.0 - Suspensão'),
	('8','5','5.1 - Diferimento'),
	('9','6','6 - ICMS cobrado anteriormente por substituição tributária'),
	('10','7','7 - Com redução de base de cálculo e cobrança do ICMS por substituição tributária'),
	('11','9','9 - Outras');
/*!40000 ALTER TABLE `cad_aliquota_tributacao` ENABLE KEYS*/;
UNLOCK TABLES;

CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_cartoes` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `nome_cartao` varchar(30) NOT NULL default '',
  `porc_sobre_venda` DOUBLE NOT NULL default '0.0000',
  `dias_apos_lc_parcela` int(4) unsigned NOT NULL default '0',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `cart` (`nome_cartao`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
LOCK TABLES `cad_cartoes` WRITE;
/*!40000 ALTER TABLE `cad_cartoes` DISABLE KEYS*/;
INSERT IGNORE INTO `cad_cartoes` (`id`, `nome_cartao`, `porc_sobre_venda`, `dias_apos_lc_parcela`) VALUES
	('1','VISA','4','0'),
	('2','MASTERCARD','4','0'),
	('3','AMEX','4','0');
/*!40000 ALTER TABLE `cad_cartoes` ENABLE KEYS*/;
UNLOCK TABLES;

CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_cep` (
  `id` int(4) unsigned zerofill NOT NULL auto_increment,
  `cep` varchar(9) default NULL,
  `logradouro` varchar(100) default NULL,
  `bairro` varchar(60) default NULL,
  `cidade` varchar(60) default NULL,
  `uf` char(2) default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  UNIQUE KEY `NewIndex` (`cep`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_class_fiscal` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `legenda` char(2) default NULL,
  `codigo` varchar(20) default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_clientes` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `cod_barra` varchar(13) default NULL,
  `nome_cliente` varchar(60) default NULL,
  `cep` varchar(15) default NULL,
  `endereco` varchar(100) default NULL,
  `bairro` varchar(60) default NULL,
  `cidade` varchar(60) default NULL,
  `uf` char(2) default NULL,
  `email` varchar(100) default NULL,
  `telefone` varchar(15) default NULL,
  `celular` varchar(15) default NULL,
  `cpf_cnpj` varchar(18) default NULL,
  `rg_ie` varchar(16) default NULL,
  `inf_adicional` varchar(255) default NULL,
  `faixa_salarial` DOUBLE default NULL,
  `vr_maximo_compra` DOUBLE default NULL,
  `desconto_autom` DOUBLE default NULL,
  `saldo_compras` DOUBLE default NULL,
  `pontos` int(4) unsigned default NULL,
  `enviar_email` int(4) unsigned default NULL,
  `inativo` int(4) unsigned default NULL,
  `nascimento_dia` int(4) unsigned default NULL,
  `nascimento_mes` int(4) unsigned default NULL,
  `nascimento_ano` varchar(4) default NULL,
  `data_cadastro` date default NULL,
  `data_ultima_alteracao` date default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_clientes_convenio` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `id_cliente_master` int(4) unsigned NOT NULL default '0',
  `id_cliente_conveniado` int(4) unsigned NOT NULL default '0',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_1` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_clientes_obs` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `id_cliente` int(4) unsigned NOT NULL default '0',
  `observacoes` text,
  `foto` blob,
  `foto_tipo` varchar(4) default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_clientes_vendedores` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `id_cliente` int(4) unsigned NOT NULL default '0',
  `id_vendedor` int(4) unsigned NOT NULL default '0',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_1` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_conta` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `conta_descricao` varchar(30) NOT NULL default '',
  `inf_adicional` varchar(100) NOT NULL default '',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
LOCK TABLES `cad_conta` WRITE;
/*!40000 ALTER TABLE `cad_conta` DISABLE KEYS*/;
INSERT IGNORE INTO `cad_conta` (`id`, `conta_descricao`, `inf_adicional`) VALUES
	('1','LOJA','CONTA PRINCIPAL');
/*!40000 ALTER TABLE `cad_conta` ENABLE KEYS*/;
UNLOCK TABLES;

DROP TABLE IF EXISTS cad_empresa;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_empresa` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `nome_empresa` varchar(100) default NULL,
  `cep` varchar(15) default NULL,
  `endereco` varchar(100) default NULL,
  `bairro` varchar(60) default NULL,
  `cidade` varchar(60) default NULL,
  `uf` char(2) default NULL,
  `email` varchar(100) default NULL,
  `site` varchar(100) default NULL,
  `telefone` varchar(15) default NULL,
  `fax` varchar(15) default NULL,
  `cpf_cpnj` varchar(18) default NULL,
  `rg_ie` varchar(16) default NULL,
  `im` varchar(20) default NULL,
  `foto` blob,
  `foto_tipo` varchar(4) default NULL,
  `qtd_turnos` char(1) NOT NULL default '1',
  `qtd_terminal` int(4) unsigned default '1',
  `chave_liberacao` varchar(21) default NULL,
  `max_desc` DOUBLE default NULL,
  `juros_atraso` DOUBLE default NULL,
  `txt_venda` text,
  `txt_venda_vip` text,
  `txt_orcamento` text,
  `txt_ordem_servico` text,
  `opcoes_globais` varchar(255) default NULL,
  `vr_ponto` DOUBLE default NULL,
  `casas_decimais` int(4) unsigned NOT NULL default '2',
  `forma_5_pagto` varchar(15) default NULL,
  `simbolo_monetario` varchar(5) default NULL,
  `txt_carne` text,
  `txt_carne_reduzido` varchar(30) default NULL,
  `smtp_server` varchar(150) default NULL,
  `smtp_email` varchar(200) default NULL,
  `smtp_senha` varchar(50) default NULL,
  `smtp_user` varchar(200) default NULL,
  `smtp_tipo` int(4) unsigned NOT NULL default '0',
  `smtp_porta` int(4) unsigned default NULL,
  `modo_busca_pdv` int(4) unsigned NOT NULL default '0',
  `modo_busca_data` int(4) unsigned NOT NULL default '0',
  `fracionado` int(4) unsigned NOT NULL default '0',
  `lucro_varejo` DOUBLE default NULL,
  `lucro_atacado` DOUBLE default NULL,
  `modo_gera_cod` int(4) unsigned NOT NULL default '0',
  `smtp_tempo_delay` int(4) unsigned NOT NULL default '5',
  `forma_5_taxa` DOUBLE NOT NULL default '0.0000',
  `juros_cheque` DOUBLE NOT NULL default '0.0000',
  `juros_carne` DOUBLE NOT NULL default '0.0000',
  `juros_5_forma` DOUBLE NOT NULL default '0.0000',
  `juros_cartao` DOUBLE NOT NULL default '0.0000',
  `milesegundos` int(4) unsigned NOT NULL default '9',
  `recibo_titulo` varchar(50) default 'RECIBO DE VENDA',
  `recibo_itens` varchar(20) default 'ITENS',
  `modo_busca_rapida` int(4) unsigned NOT NULL default '0',
  `recibo_controle` varchar(20) default 'CONTROLE:',
  `recibo_vendedor` varchar(20) default 'VENDEDOR(A):',
  `msg_recibo_desconto` varchar(20) default '',
  `msg_recibo_acrescimo` varchar(20) default '',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_fornecedores` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `nome_fornecedor` varchar(60) default NULL,
  `cep` varchar(15) default NULL,
  `endereco` varchar(100) default NULL,
  `bairro` varchar(60) default NULL,
  `cidade` varchar(60) default NULL,
  `uf` char(2) default NULL,
  `email` varchar(100) default NULL,
  `telefone` varchar(15) default NULL,
  `fax` varchar(15) default NULL,
  `cpf_cnpj` varchar(18) default NULL,
  `rg_ie` varchar(16) default NULL,
  `contato` varchar(30) default NULL,
  `inativo` int(4) unsigned default NULL,
  `inf_adicional` varchar(255) default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_lancamentos` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `id_planejamento` int(4) unsigned default NULL,
  `id_conta` int(4) unsigned default NULL,
  `id_modo_lancamento` int(4) unsigned default NULL,
  `status_lancamento` int(4) unsigned default NULL,
  `controle` varchar(14) default NULL,
  `documento` varchar(30) default NULL,
  `historico` varchar(255) default NULL,
  `parcela` int(4) unsigned default NULL,
  `data_vencimento` date default NULL,
  `vr_parcela` DOUBLE default NULL,
  `vr_abatimentos` DOUBLE default NULL,
  `vr_acrescimo` DOUBLE default NULL,
  `transferido` int(4) unsigned default NULL,
  `id_cliente` int(4) unsigned default NULL,
  `id_venda` int(4) unsigned default NULL,
  `data_confirmacao` date default NULL,
  `lancado_no_caixa` int(4) unsigned default NULL,
  `id_cartao` int(4) unsigned default NULL,
  `dias_atraso` int(4) unsigned default '0',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
#
# Dumping data for table 'cad_lancamentos'
#

# (No data found.)



#
# Table structure for table 'cad_lancamentos_obs'
#

CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_lancamentos_obs` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `id_lancamento` int(4) unsigned NOT NULL default '0',
  `observacoes` text,
  `foto` blob,
  `controle` varchar(14) default NULL,
  `foto_tipo` varchar(4) default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_login` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `login` varchar(15) default NULL,
  `senha` varchar(6) default NULL,
  `id_perfil` int(4) unsigned NOT NULL default '1',
  `options` varchar(100) default NULL,
  `inativo` int(4) unsigned default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  UNIQUE KEY `in2` (`login`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_login_perfil` (
  `id_perfil` int(4) unsigned NOT NULL auto_increment,
  `nome_perfil` varchar(30) default NULL,
  `menu_options` varchar(250) default NULL,
  PRIMARY KEY  (`id_perfil`),
  UNIQUE KEY `id_perfil` (`id_perfil`),
  UNIQUE KEY `NewIndex` (`nome_perfil`),
  KEY `id_perfil_2` (`id_perfil`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
LOCK TABLES `cad_login_perfil` WRITE;
/*!40000 ALTER TABLE `cad_login_perfil` DISABLE KEYS*/;
INSERT IGNORE INTO `cad_login_perfil` (`id_perfil`, `nome_perfil`, `menu_options`) VALUES
	('1','ADMINISTRADOR','SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS');
/*!40000 ALTER TABLE `cad_login_perfil` ENABLE KEYS*/;
UNLOCK TABLES;

CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_modo_lancamento` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `modo_lancamento` varchar(30) default NULL,
  `protegido` char(1) default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
LOCK TABLES `cad_modo_lancamento` WRITE;
/*!40000 ALTER TABLE `cad_modo_lancamento` DISABLE KEYS*/;
INSERT IGNORE INTO `cad_modo_lancamento` (`id`, `modo_lancamento`, `protegido`) VALUES
	('1','DINHEIRO','X'),
	('2','CHEQUE','X'),
	('4','BOLETO','X'),
	('5','CARNÊ','X'),
	('6','CARTÃO DÉBITO','X'),
	('7','CARTÃO CRÉDITO','X'),
	('8','TICKET',NULL),
	('9','PROMISSÓRIA',NULL),
	('10','DUPLICATA',NULL),
	('11','TRANSFERÊNCIA BANCÁRIA',NULL);
/*!40000 ALTER TABLE `cad_modo_lancamento` ENABLE KEYS*/;
UNLOCK TABLES;

CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_moedas` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `moeda` varchar(4) NOT NULL default '',
  `cotacao` DOUBLE NOT NULL default '0.0000',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
LOCK TABLES `cad_moedas` WRITE;
/*!40000 ALTER TABLE `cad_moedas` DISABLE KEYS*/;
INSERT IGNORE INTO `cad_moedas` (`id`, `moeda`, `cotacao`) VALUES
	('1','R$','1');
/*!40000 ALTER TABLE `cad_moedas` ENABLE KEYS*/;
UNLOCK TABLES;

CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_planejamento` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `plane_cod` int(4) unsigned default NULL,
  `plane_descricao` varchar(50) default NULL,
  `plane_tipo` char(1) default NULL,
  `protegido` char(1) default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
LOCK TABLES `cad_planejamento` WRITE;
/*!40000 ALTER TABLE `cad_planejamento` DISABLE KEYS*/;
INSERT IGNORE INTO `cad_planejamento` (`id`, `plane_cod`, `plane_descricao`, `plane_tipo`, `protegido`) VALUES
	('1','100000','RECEITAS DIVERSAS','E',''),
	('2','110000','VENDA REALIZADA','E','X'),
	('3','120000','OUTROS RECEBIMENTOS','E',''),
	('4','200000','DESPESAS DIVERSAS','S',''),
	('5','210000','DEVOLUÇÃO REALIZADA','S','X'),
	('6','220000','CONTAS DE CONSUMO','S',''),
	('7','230000','CONTA DE ÁGUA / CONDOMINIO','S',''),
	('8','240000','CONTA DE LUZ','S',''),
	('9','250000','CONTA TELEFONE','S','');
/*!40000 ALTER TABLE `cad_planejamento` ENABLE KEYS*/;
UNLOCK TABLES;

CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_produtos` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `nome_produto` varchar(60) default NULL,
  `cod_barra` varchar(13) default NULL,
  `unidade` char(3) default NULL,
  `inf_adicional` varchar(30) default NULL,
  `pontos` int(4) unsigned default '0',
  `id_moeda` int(4) unsigned default '1',
  `modo_estoque` int(4) unsigned default '1',
  `grade` int(4) unsigned NOT NULL default '0',
  `kit` int(4) unsigned NOT NULL default '0',
  `id_tipo` int(4) unsigned default '1',
  `vr_compra` DOUBLE default NULL,
  `vr_venda` DOUBLE default NULL,
  `vr_venda_2` DOUBLE default NULL,
  `min_estoque` DOUBLE default '0.0000',
  `estoque` DOUBLE default '0.0000',
  `inativo` int(4) unsigned default '0',
  `aliq_ipi` DOUBLE default '0.0000',
  `inside_icms_ipi` int(4) unsigned default NULL,
  `id_class_fiscal` int(4) unsigned default NULL,
  `aliq_id_base_icms` int(4) unsigned default NULL,
  `origem_produto` int(4) unsigned default NULL,
  `fracionado` int(4) unsigned default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  UNIQUE KEY `NewIndex` (`nome_produto`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_produtos_fornecedores` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `id_produto` int(4) unsigned NOT NULL default '0',
  `id_fornecedor` int(4) unsigned NOT NULL default '0',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_1` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_produtos_grade` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `id_produto` int(4) unsigned NOT NULL default '0',
  `descricao` varchar(30) NOT NULL default '0',
  `quantidade` DOUBLE default '0.000',
  `cod_barra` varchar(13) default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_produtos_kit` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `id_produto_master` int(4) unsigned NOT NULL default '0',
  `id_produto_usado` int(4) unsigned NOT NULL default '0',
  `quantidade` DOUBLE default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_1` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_produtos_obs` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `id_produto` int(4) unsigned NOT NULL default '0',
  `observacoes` text,
  `foto` blob,
  `foto_tipo` varchar(4) default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_produtos_tipo` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `nome_tipo` varchar(30) NOT NULL default '',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `NewIndex` (`nome_tipo`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `cad_transportadora` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `nome_transportadora` varchar(60) NOT NULL default '',
  `cep` varchar(15) default NULL,
  `endereco` varchar(100) default NULL,
  `bairro` varchar(60) default NULL,
  `cidade` varchar(60) default NULL,
  `placa_veiculo` varchar(8) default NULL,
  `uf` char(2) default NULL,
  `uf_placa` char(2) default NULL,
  `email` varchar(100) default NULL,
  `telefone` varchar(15) default NULL,
  `cpf_cnpj` varchar(18) default NULL,
  `rg_ie` varchar(16) default NULL,
  `motorista` varchar(30) default NULL,
  `inativo` int(4) unsigned default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
LOCK TABLES `cad_transportadora` WRITE;
/*!40000 ALTER TABLE `cad_transportadora` DISABLE KEYS*/;
INSERT IGNORE INTO `cad_transportadora` (`id`, `nome_transportadora`, `cep`, `endereco`, `bairro`, `cidade`, `placa_veiculo`, `uf`, `uf_placa`, `email`, `telefone`, `cpf_cnpj`, `rg_ie`, `motorista`, `inativo`) VALUES
	('1','O PRÓPRIO',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'0');
/*!40000 ALTER TABLE `cad_transportadora` ENABLE KEYS*/;
UNLOCK TABLES;

CREATE TABLE /*!32312 IF NOT EXISTS*/ `eti_config` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `nome_etiqueta` varchar(60) default NULL,
  `pag_comprimento` DOUBLE default NULL,
  `pag_largura` DOUBLE default NULL,
  `qtd_colunas` int(4) unsigned default '0',
  `espaco_colunas` DOUBLE default NULL,
  `etq_comprimento` DOUBLE default NULL,
  `marg_top` DOUBLE default NULL,
  `marg_bottom` DOUBLE default NULL,
  `marg_left` DOUBLE default NULL,
  `marg_right` DOUBLE default NULL,
  `ajuste_em` int(4) unsigned default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
LOCK TABLES `eti_config` WRITE;
/*!40000 ALTER TABLE `eti_config` DISABLE KEYS*/;
INSERT IGNORE INTO `eti_config` (`id`, `nome_etiqueta`, `pag_comprimento`, `pag_largura`, `qtd_colunas`, `espaco_colunas`, `etq_comprimento`, `marg_top`, `marg_bottom`, `marg_left`, `marg_right`, `ajuste_em`) VALUES
	('1','PRODUTOS MODO SIMPLES (1 CODIGO DE BARRA)','29.9','21.1','5','0.35','2.1','1','1','0.5','0.5','1'),
	('2','PRODUTOS MODO DUPLO    (2 CODIGO DE BARRA)','27.94','21.59','4','0.2','6.2','1.4','1.4','1.6','1.6','1'),
	('3','CLIENTES & FORNECEDORES ETIQUETA COM ENDERECO P/ MALA-DIRETA','27.94','21.59','2','0.4','2.5','1.7','1','0.7','0.5','1'),
	('4','CLIENTES & FORNECEDORES IMPRESSAO DIRETA NO ENVELOPE','11','23','1','0','9','4','1','10','1','1');
/*!40000 ALTER TABLE `eti_config` ENABLE KEYS*/;
UNLOCK TABLES;

CREATE TABLE /*!32312 IF NOT EXISTS*/ `eti_config_campo` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `nome_demonstrativo` varchar(30) default NULL,
  `id_etiqueta` int(4) unsigned default NULL,
  `id_class` int(4) unsigned default NULL,
  `usar` int(4) unsigned default NULL,
  `nome_campo` varchar(30) default NULL,
  `top_e` DOUBLE default NULL,
  `left_e` DOUBLE default NULL,
  `width_e` DOUBLE default NULL,
  `height_e` DOUBLE default NULL,
  `font_size_e` int(4) unsigned default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
LOCK TABLES `eti_config_campo` WRITE;
/*!40000 ALTER TABLE `eti_config_campo` DISABLE KEYS*/;
INSERT IGNORE INTO `eti_config_campo` (`id`, `nome_demonstrativo`, `id_etiqueta`, `id_class`, `usar`, `nome_campo`, `top_e`, `left_e`, `width_e`, `height_e`, `font_size_e`) VALUES
	('1','NOME DO PRODUTO','1','3','0','c1','0.2','0.4','3.2','0.5','5'),
	('2','IMAGEM CÓDIGO DE BARRA','1','2','0','c2','0.5','0.6','4','1','5'),
	('3','VALOR DE VAREJO','1','1','0','c3','1.5','0.4','1.5','0.4','6'),
	('4','INFORMAÇÕES ADICIONAIS','1','1','1','c4','1.8','0.4','3.2','0.2','4'),
	('5','VALOR DE ATACADO','1','1','0','c5','1.5','1.5','1.5','0.4','6'),
	('6','NOME DA EMPRESA','2','1','0','c6','1','0.2','3.9','0.3','5'),
	('7','NOME DO FORNECEDOR','2','1','0','c7','1.4','0.2','3.9','0.2','5'),
	('8','NOME DO PRODUTO ( 1 )','2','3','0','c8','1.7','0.2','3.9','0.5','7'),
	('9','NOME DO TIPO','2','1','0','c9','2.2','0.2','3.9','0.2','5'),
	('10','INFORMAÇÕES ADICIONAIS','2','1','0','c10','2.5','0.2','3.9','0.2','5'),
	('11','IMAGEM CÓDIGO DE BARRA ( 1 )','2','2','0','c11','2.8','0.9','2.8','0.8','8'),
	('12','NOME DO PRODUTO ( 2 )','2','3','0','c12','4','0.2','3.9','0.5','7'),
	('13','IMAGEM CÓDIGO DE BARRA ( 2 )','2','2','0','c13','4.7','0.9','2.8','0.8','8'),
	('14','VALOR DE VAREJO','2','1','0','c14','5.6','2.2','1.8','0.4','8'),
	('15','VALOR DE ATACADO','2','1','0','c15','5.6','0.2','1.8','0.4','8'),
	('16','NOME DO CLIENTE/FORNECEDOR','3','1','0','c16','0.3','0.1','6.6','0.3','8'),
	('17','ENDEREÇO','3','1','0','c17','0.7','0.1','6.7','0.3','8'),
	('18','BAIRRO','3','1','0','c18','1.1','0.1','6.6','0.3','8'),
	('19','CIDADE','3','1','0','c19','1.5','0.1','3.5','0.3','8'),
	('20','ESTADO','3','1','0','c20','1.9','3.1','0.4','0.3','8'),
	('21','CEP','3','1','0','c21','1.9','0.1','2.8','0.3','8'),
	('22','CODIGO DE BARRA ( DO CLIENTE )','3','2','1','c22','1.5','3.9','2.8','0.8','8'),
	('23','NOME DA EMPRESA','1','1','1','c23','1.8','0.4','1.5','0.4','5'),
	('24','LOGOMARCA DA EMPRESA','1','2','1','c24','0','0','5','0.3','5'),
	('25','NOME DO CLIENTE/FORNECEDOR','4','1','0','c25','5','3','9','0.3','8'),
	('26','ENDEREÇO','4','1','0','c26','5','3','9','0.3','8'),
	('27','BAIRRO','4','1','0','c27','5','13','4','0.3','8'),
	('28','CIDADE','4','1','0','c28','5','3','9','0.3','8'),
	('29','ESTADO','4','1','0','c29','5','13','0','0.3','8'),
	('30','CEP','4','1','0','c30','10','3','4','0.3','8'),
	('31','LOGOMARCA DA EMPRESA','4','2','0','c31','1','1','5','0.3','8'),
	('32','CÓDIGO DE BARRA ( DO CLIENTE )','4','2','0','c32','5','17','2','0.3','8'),
	('33','OBSERVAÇÕES','4','3','0','c33','7','3','9','1','8'),
	('34','INFORMAÇÕES ADICIONAIS','4','3','0','c34','6','3','9','0.3','8');
/*!40000 ALTER TABLE `eti_config_campo` ENABLE KEYS*/;
UNLOCK TABLES;

CREATE TABLE /*!32312 IF NOT EXISTS*/ `mv_caixa` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `hora_abertura` time NOT NULL default '00:00:00',
  `hora_fechamento` time default NULL,
  `data_abertura` date NOT NULL default '0000-00-00',
  `data_fechamento` date default NULL,
  `vr_abertura` DOUBLE NOT NULL default '0.0000',
  `vr_fechamento` DOUBLE NOT NULL default '0.0000',
  `vr_fechado_turno` DOUBLE NOT NULL default '0.0000',
  `id_login` int(4) unsigned default NULL,
  `turno` char(1) default NULL,
  `terminal` char(2) default NULL,
  `status_caixa` char(1) NOT NULL default 'A',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `mv_estoque_historico` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `modo_lancamento` int(4) unsigned default NULL,
  `nota_entrada` varchar(15) default NULL,
  `id_fornecedor` int(4) unsigned NOT NULL default '0',
  `id_produto` int(4) unsigned NOT NULL default '0',
  `id_grade` int(4) unsigned default NULL,
  `data_entrada` date default NULL,
  `quantidade` DOUBLE default NULL,
  `valor` DOUBLE default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `mv_login` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `data_entrada` date NOT NULL default '0000-00-00',
  `data_saida` date default NULL,
  `hora_entrada` time NOT NULL default '00:00:00',
  `hora_saida` time default NULL,
  `id_login` int(4) unsigned NOT NULL default '0',
  `ip_maquina` varchar(15) NOT NULL default '',
  `nome_maquina` varchar(50) NOT NULL default '',
  `status_login` int(4) unsigned NOT NULL default '0',
  `terminal` char(2) NOT NULL default '01',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `mv_nota_fiscal` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `numero` varchar(30) NOT NULL default '',
  `data_emissao` date NOT NULL default '0000-00-00',
  `data_saida` date NOT NULL default '0000-00-00',
  `hora_saida` time NOT NULL default '00:00:00',
  `id_login` int(4) unsigned NOT NULL default '0',
  `id_cliente` int(4) unsigned NOT NULL default '0',
  `id_venda` int(4) unsigned NOT NULL default '0',
  `id_transp` int(4) unsigned NOT NULL default '0',
  `transp_tipo` int(4) unsigned NOT NULL default '0',
  `transp_quantidade` DOUBLE default NULL,
  `transp_especie` varchar(15) default NULL,
  `transp_marca` varchar(15) default NULL,
  `transp_numero` int(4) unsigned default NULL,
  `transp_peso_bruto` DOUBLE default NULL,
  `transp_peso_liq` DOUBLE default NULL,
  `transp_tara` DOUBLE default NULL,
  `base_calc_icms` DOUBLE default NULL,
  `vr_do_icms` DOUBLE default NULL,
  `base_calc_icms_sub` DOUBLE default NULL,
  `vr_icms_sub` DOUBLE default NULL,
  `base_calc_iss` DOUBLE default NULL,
  `vr_do_iss` DOUBLE default NULL,
  `vr_do_ipi` DOUBLE default NULL,
  `vr_do_frete` DOUBLE default NULL,
  `vr_do_seguro` DOUBLE default NULL,
  `vr_total_servicos` DOUBLE default NULL,
  `vr_total_produtos` DOUBLE default NULL,
  `vr_total_nota` DOUBLE default NULL,
  `vr_outras_despesas` DOUBLE default NULL,
  `vr_desconto` DOUBLE default NULL,
  `observacoes` varchar(255) default NULL,
  `ie_substituto_tributario` varchar(20) default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `mv_vendas` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `controle` varchar(14) default NULL,
  `nota_fiscal_numero` varchar(30) default NULL,
  `data_venda` date default NULL,
  `parcelas` int(4) unsigned default NULL,
  `id_cliente` int(4) unsigned NOT NULL default '0',
  `id_cliente_convenio` int(4) unsigned NOT NULL default '0',
  `id_login` int(4) unsigned default NULL,
  `terminal` char(2) default NULL,
  `turno` char(1) default NULL,
  `vr_total` DOUBLE default NULL,
  `vr_adicional` DOUBLE default NULL,
  `vr_dinheiro` DOUBLE default NULL,
  `vr_cheque` DOUBLE default NULL,
  `vr_cartao` DOUBLE default NULL,
  `vr_carne` DOUBLE default NULL,
  `vr_ticket` DOUBLE default NULL,
  `em_aberto` int(4) unsigned NOT NULL default '0',
  `vr_pagto_parcial` DOUBLE default NULL,
  `cod_lancamento` int(4) unsigned NOT NULL default '0',
  `web_pagto` varchar(100) default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `mv_vendas_locado` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `data_venda` date NOT NULL default '0000-00-00',
  `controle` varchar(14) NOT NULL default '',
  `cod_lancamento` int(4) unsigned NOT NULL default '0',
  `id_login` int(4) unsigned default NULL,
  `id_cliente` int(4) unsigned NOT NULL default '0',
  `id_cliente_convenio` int(4) unsigned NOT NULL default '0',
  `id_produto` int(4) unsigned NOT NULL default '0',
  `id_grade` int(4) unsigned NOT NULL default '0',
  `modo_lancamento` int(4) unsigned NOT NULL default '0',
  `terminal` char(2) NOT NULL default '',
  `turno` char(1) NOT NULL default '',
  `valor` DOUBLE NOT NULL default '0.0000',
  `data_locacao` date NOT NULL default '0000-00-00',
  `data_devolucao` date NOT NULL default '0000-00-00',
  `status_locacao` int(4) unsigned NOT NULL default '0',
  `vr_cotacao` DOUBLE NOT NULL default '0.0000',
  `diarias` int(4) unsigned NOT NULL default '1',
  `vr_total` DOUBLE NOT NULL default '0.0000',
  `quant` DOUBLE NOT NULL default '1.000',
  `desconto_total_venda` char(1) default 'N',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `mv_vendas_movimento` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `data_venda` date NOT NULL default '0000-00-00',
  `controle` varchar(14) NOT NULL default '',
  `modo_venda` int(4) unsigned NOT NULL default '0',
  `cod_lancamento` int(4) unsigned NOT NULL default '0',
  `id_login` int(4) unsigned default NULL,
  `id_cliente` int(4) unsigned NOT NULL default '0',
  `id_cliente_convenio` int(4) unsigned NOT NULL default '0',
  `id_produto` int(4) unsigned NOT NULL default '0',
  `id_grade` int(4) unsigned NOT NULL default '0',
  `modo_lancamento` int(4) unsigned NOT NULL default '0',
  `terminal` char(2) NOT NULL default '',
  `turno` char(1) NOT NULL default '',
  `valor` DOUBLE NOT NULL default '0.0000',
  `quant` DOUBLE NOT NULL default '1.000',
  `vr_total` DOUBLE NOT NULL default '0.0000',
  `vr_cotacao` DOUBLE NOT NULL default '0.0000',
  `desconto_total_venda` char(1) default 'N',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `mv_vendas_obs` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `id_venda` int(4) unsigned NOT NULL default '0',
  `controle` varchar(14) NOT NULL default '',
  `observacao` text,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `mv_vendas_servico` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `controle` varchar(14) default NULL,
  `cod_lancamento` int(4) unsigned NOT NULL default '0',
  `id_cliente` int(4) unsigned NOT NULL default '0',
  `id_cliente_convenio` int(4) unsigned NOT NULL default '0',
  `id_login` int(4) unsigned default NULL,
  `data_entrada` date NOT NULL default '0000-00-00',
  `data_saida` date NOT NULL default '0000-00-00',
  `situacao_servico` int(4) unsigned NOT NULL default '0',
  `tec_responsavel` varchar(30) default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `mv_vendas_servico_movimento` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `data_venda` date default NULL,
  `controle` varchar(14) default NULL,
  `cod_lancamento` int(4) unsigned default NULL,
  `id_login` int(4) unsigned default NULL,
  `id_cliente` int(4) unsigned default NULL,
  `id_cliente_convenio` int(4) unsigned default NULL,
  `id_produto` int(4) unsigned default NULL,
  `modo_lancamento` int(4) unsigned default NULL,
  `terminal` char(2) default NULL,
  `turno` char(1) default NULL,
  `valor` DOUBLE default NULL,
  `vr_cotacao` DOUBLE default NULL,
  `vr_total` DOUBLE default NULL,
  `desconto_total_venda` char(1) default 'N',
  `situacao_servico` int(4) unsigned NOT NULL default '0',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE /*!32312 IF NOT EXISTS*/ `nota_config` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `titulo_nota` varchar(60) NOT NULL default '',
  `pag_comprimento` DOUBLE NOT NULL default '0.0000',
  `pag_largura` DOUBLE NOT NULL default '0.0000',
  `marg_top` DOUBLE NOT NULL default '0.0000',
  `marg_bottom` DOUBLE NOT NULL default '0.0000',
  `marg_left` DOUBLE NOT NULL default '0.0000',
  `marg_right` DOUBLE NOT NULL default '0.0000',
  `itens_top` DOUBLE NOT NULL default '0.0000',
  `itens_left` DOUBLE NOT NULL default '0.0000',
  `itens_width` DOUBLE NOT NULL default '0.0000',
  `itens_height` DOUBLE NOT NULL default '0.0000',
  `itens_qtd_linha` int(4) unsigned NOT NULL default '0',
  `fat_top` DOUBLE NOT NULL default '0.0000',
  `fat_left` DOUBLE NOT NULL default '0.0000',
  `fat_width` DOUBLE NOT NULL default '0.0000',
  `fat_height` DOUBLE NOT NULL default '0.0000',
  `fat_qtd_linha` int(4) unsigned NOT NULL default '0',
  `fat_qtd_coluna` int(4) unsigned NOT NULL default '0',
  `natureza_operacao` varchar(30) NOT NULL default '',
  `reservado_fisco` varchar(255) default NULL,
  `cfop` varchar(10) NOT NULL default '',
  `serv_top` DOUBLE NOT NULL default '0.0000',
  `serv_left` DOUBLE NOT NULL default '0.0000',
  `serv_width` DOUBLE NOT NULL default '0.0000',
  `serv_height` DOUBLE NOT NULL default '0.0000',
  `serv_qtd_linha` int(4) unsigned NOT NULL default '0',
  `mostra_fatura` int(4) unsigned NOT NULL default '0',
  `mostra_servico` int(4) unsigned NOT NULL default '0',
  `mostra_produto` int(4) unsigned NOT NULL default '0',
  `fat_espaco_coluna` int(4) unsigned NOT NULL default '0',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
LOCK TABLES `nota_config` WRITE;
/*!40000 ALTER TABLE `nota_config` DISABLE KEYS*/;
INSERT IGNORE INTO `nota_config` (`id`, `titulo_nota`, `pag_comprimento`, `pag_largura`, `marg_top`, `marg_bottom`, `marg_left`, `marg_right`, `itens_top`, `itens_left`, `itens_width`, `itens_height`, `itens_qtd_linha`, `fat_top`, `fat_left`, `fat_width`, `fat_height`, `fat_qtd_linha`, `fat_qtd_coluna`, `natureza_operacao`, `reservado_fisco`, `cfop`, `serv_top`, `serv_left`, `serv_width`, `serv_height`, `serv_qtd_linha`, `mostra_fatura`, `mostra_servico`, `mostra_produto`, `fat_espaco_coluna`) VALUES
	('1','NOTA FISCAL DE SAÍDA','28','21','0','0','0','0','9','0','21','6','17','7','0','21','1','3','3','V E N D A','','5.102','15','0','21','2','5','0','0','0','6');
/*!40000 ALTER TABLE `nota_config` ENABLE KEYS*/;
UNLOCK TABLES;

CREATE TABLE /*!32312 IF NOT EXISTS*/ `nota_config_campo` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `nome_campo` varchar(10) NOT NULL default '',
  `nome_demonstrativo` varchar(40) NOT NULL default '',
  `id_nota` int(4) unsigned NOT NULL default '0',
  `id_class` int(4) unsigned NOT NULL default '0',
  `top_e` DOUBLE NOT NULL default '0.0000',
  `left_e` DOUBLE NOT NULL default '0.0000',
  `width_e` DOUBLE NOT NULL default '0.0000',
  `height_e` DOUBLE NOT NULL default '0.0000',
  `font_size` int(4) unsigned NOT NULL default '0',
  `usar` int(4) unsigned NOT NULL default '0',
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
LOCK TABLES `nota_config_campo` WRITE;
/*!40000 ALTER TABLE `nota_config_campo` DISABLE KEYS*/;
INSERT IGNORE INTO `nota_config_campo` (`id`, `nome_campo`, `nome_demonstrativo`, `id_nota`, `id_class`, `top_e`, `left_e`, `width_e`, `height_e`, `font_size`, `usar`) VALUES
	('1','n1','EMPRESA NOME','1','3','0','4','7','0','10','1'),
	('2','n2','EMPRESA ENDEREÇO','1','3','0','4','7','0','10','0'),
	('3','n3','EMPRESA BAIRRO','1','3','1','4','4','0','10','0'),
	('4','n4','EMPRESA CEP','1','3','1','10','3','0','10','0'),
	('5','n5','EMPRESA CIDADE','1','3','1','4','4','0','10','0'),
	('6','n6','EMPRESA UF','1','3','1','8','0','0','10','0'),
	('7','n7','EMPRESA TELEFONE','1','3','1','9','2','0','10','0'),
	('8','n8','EMPRESA CNPJ','1','1','2','13','4','0','10','0'),
	('9','n9','EMPRESA INSCRIÇÃO ESTADUAL','1','3','3','13','4','0','10','0'),
	('10','n10','CLIENTE NOME','1','3','4','0','12','0','10','0'),
	('11','n11','CLIENTE ENDEREÇO','1','3','5','0','11','0','10','0'),
	('12','n12','CLIENTE BAIRRO','1','3','5','11','2','0','10','0'),
	('13','n13','CLIENTE CEP','1','3','5','14','2','0','10','0'),
	('14','n14','CLIENTE CIDADE','1','3','6','0','8','0','10','0'),
	('15','n15','CLIENTE UF','1','3','6','11','0','0','10','0'),
	('16','n16','CLIENTE TELEFONE','1','3','6','8','3','0','10','0'),
	('17','n17','CLIENTE CNPJ/CPF','1','1','4','11','4','0','10','0'),
	('18','n18','CLIENTE INSCRIÇÃO ESTADUAL/RG','1','3','6','13','4','0','10','0'),
	('19','n19','TRANSPORTADORA NOME','1','3','18','0','8','0','10','0'),
	('20','n20','TRANSPORTADORA FRETE ( 1 ou 2 )','1','3','18','11','0','0','10','0'),
	('21','n21','TRANSPORTADORA PLACA DO VEÍCULO','1','3','18','12','2','0','10','0'),
	('22','n22','TRANSPORTADORA PLACA UF','1','3','18','14','0','0','10','0'),
	('23','n23','TRANSPORTADORA CNPJ/CPF','1','1','18','15','4','0','10','0'),
	('24','n24','TRANSPORTADORA ENDEREÇO','1','3','19','0','8','0','10','0'),
	('25','n25','TRANSPORTADORA CIDADE','1','3','19','9','4','0','10','0'),
	('26','n26','TRANSPORTADORA UF','1','3','19','14','0','0','10','0'),
	('27','n27','TRANSPORTADORA INSCRIÇÃO ESTADUAL/RG','1','3','19','15','4','0','10','0'),
	('28','n28','NOTA N?MERO DE SÉRIE ( 1 )','1','3','1','18','2','0','10','0'),
	('29','n29','NOTA N?MERO DE SÉRIE ( 2 )','1','3','25','18','2','0','10','0'),
	('30','n30','NOTA DATA EMISSÃO','1','3','4','17','2','0','10','0'),
	('31','n31','NOTA DATA SAÍDA','1','3','5','17','2','0','10','0'),
	('32','n32','NOTA HORA DA SAÍDA','1','3','6','17','2','0','10','0'),
	('33','n33','NOTA INS. ESTADUAL DO SUBSTITUTO TRIB.','1','3','3','7','4','0','10','0'),
	('34','n34','NOTA CFOP','1','3','3','5','1','0','10','0'),
	('35','n35','NOTA BASE DE CÁLCULO DO ICMS','1','1','16','0','3','0','10','0'),
	('36','n36','NOTA VALOR DO ICMS','1','1','16','4','3','0','10','0'),
	('37','n37','NOTA BASE DE CÁLCULO DO ISS','1','1','16','0','3','0','10','1'),
	('38','n38','NOTA VALOR DO ISS','1','1','16','4','3','0','10','1'),
	('39','n39','NOTA BASE DE CÁLCULO ICMS SUBSTITUIÇÃO','1','1','16','8','3','0','10','0'),
	('40','n40','NOTA VALOR DO ICMS SUBSTITUIÇÃO','1','1','16','12','3','0','10','0'),
	('41','n41','NOTA VALOR TOTAL DOS PRODUTOS','1','1','16','16','3','0','10','0'),
	('42','n42','NOTA VALOR TOTAL DOS SERVIÇOS','1','1','16','16','3','0','10','1'),
	('43','n43','NOTA VALOR DO FRETE','1','1','17','0','3','0','10','0'),
	('44','n44','NOTA VALOR DO SEGURO','1','1','17','4','3','0','10','0'),
	('45','n45','NOTA VALOR TOTAL DO IPI','1','1','17','12','3','0','10','0'),
	('46','n46','NOTA VALOR TOTAL DA NOTA','1','1','17','16','3','0','10','0'),
	('47','n47','NOTA ESPÉCIE','1','3','20','3','2','0','10','0'),
	('48','n48','NOTA MARCA','1','3','20','5','3','0','10','0'),
	('49','n49','NOTA NÚMERO','1','3','20','9','3','0','10','0'),
	('50','n50','NOTA PESO BRUTO','1','1','20','12','3','0','10','0'),
	('51','n51','NOTA PESO LÍQUIDO','1','1','20','16','3','0','10','0'),
	('52','n52','NOTA TARA','1','1','20','0','3','0','10','1'),
	('53','n53','NOTA INFORMAÇÕES COMPLEMENTARES','1','3','21','0','10','0','10','0'),
	('54','n54','NOTA RESERVADO AO FISCO','1','3','21','11','7','2','10','0'),
	('55','n55','NOTA QUANTIDADE GERAL','1','3','20','0','2','2','10','0'),
	('56','n56','TEXTO FIXO SAÍDA [ XX ]','1','4','1','12','1','0','10','0'),
	('57','n57','NATUREZA DA OPERAÇÃO','1','3','3','0','3','0','10','0'),
	('58','itens','CÓDIGO ITEM','1','0','0','0','0','0','14','0'),
	('59','itens','DESCRIÇÃO','1','0','0','0','0','0','26','0'),
	('60','itens','CLASSIFICAÇÃO FISCAL (C.F)','1','0','0','0','0','0','4','0'),
	('61','itens','CÓDIGO DA SITUAÇÃO TRIBUTÁRIA (C.S.T)','1','0','0','0','0','0','4','0'),
	('62','itens','UNIDADE','1','0','0','0','0','0','5','0'),
	('63','itens','QUANTIDADE','1','0','0','0','0','0','5','0'),
	('64','itens','VALOR UNITÁRIO','1','0','0','0','0','0','10','0'),
	('65','itens','VALOR TOTAL','1','0','0','0','0','0','12','0'),
	('66','itens','ALÍQUOTA ICMS','1','0','0','0','0','0','4','0'),
	('67','itens','ALÍQUOTA IPI','1','0','0','0','0','0','3','0'),
	('68','itens','VALOR IPI','1','0','0','0','0','0','6','0'),
	('69','fatura','ORDEM','1','0','0','0','0','0','4','0'),
	('70','fatura','VENCIMENTO','1','0','0','0','0','0','13','0'),
	('71','fatura','VALOR','1','0','0','0','0','0','10','0'),
	('72','servico','DESCRICAO DO SERVIÇO','1','0','0','0','0','0','40','0'),
	('73','servico','VALOR TOTAL','1','0','0','0','0','0','10','0'),
	('74','servico','ALÍQUOTA DO ISS','1','0','0','0','0','0','6','0'),
	('75','n58','NOTA VALOR OUTRAS DESPESAS ACESSÓRIAS','1','1','17','8','3','0','10','0'),
	('76','n59','VENDEDOR','1','3','0','0','0','0','10','1'),
	('77','n60','NOTA VALOR DESCONTO','1','1','17','12','3','0','10','1'),
	('78','servico','QUANTIDADE','1','1','0','0','0','0','10','0'),
	('79','servico','VR. TOTAL','1','1','0','0','0','0','10','0'),
	('80','n61','NOTA ALÍQUOTA GERAL','1','4','0','0','0','0','10','0'),
	('81','n62','FORMA DE PAGAMENTO','1','4','0','0','0','0','10','0');
/*!40000 ALTER TABLE `nota_config_campo` ENABLE KEYS*/;
UNLOCK TABLES;

CREATE TABLE /*!32312 IF NOT EXISTS*/ `pdv_arquivo` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `nome_arquivo` varchar(255) default NULL,
  `comando_sql` text,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
LOCK TABLES `pdv_arquivo` WRITE;
/*!40000 ALTER TABLE `pdv_arquivo` DISABLE KEYS*/;
INSERT IGNORE INTO `pdv_arquivo` (`id`, `nome_arquivo`, `comando_sql`) VALUES
	('1','CLIENTE.TXT','select id, nome_cliente, endereco,  bairro,  cpf_cnpj cnpj, cpf_cnpj cpf, rg_ie ie, rg_ie rg, cidade, uf, telefone from cad_clientes order by id'),
	('2','VENDEDOR.TXT','select id, login from cad_login order by id'),
	('3','PRODUTO.TXT','select P.cod_barra, P.nome_produto, P.unidade, A.cod_tributacao, P.vr_venda from cad_produtos P left join cad_aliquota A on P.aliq_id_base_icms = A.id where modo_estoque in (0,1) order by P.cod_barra');
/*!40000 ALTER TABLE `pdv_arquivo` ENABLE KEYS*/;
UNLOCK TABLES;

CREATE TABLE /*!32312 IF NOT EXISTS*/ `pdv_arquivo_opcoes` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `id_arquivo` int(4) unsigned default NULL,
  `ordem` int(4) unsigned default NULL,
  `tamanho` int(4) unsigned default NULL,
  `decimais` int(4) unsigned default NULL,
  `nome_campo` varchar(50) default NULL,
  `formato` int(4) unsigned default NULL,
  `mascara` varchar(50) default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
LOCK TABLES `pdv_arquivo_opcoes` WRITE;
/*!40000 ALTER TABLE `pdv_arquivo_opcoes` DISABLE KEYS*/;
INSERT IGNORE INTO `pdv_arquivo_opcoes` (`id`, `id_arquivo`, `ordem`, `tamanho`, `decimais`, `nome_campo`, `formato`, `mascara`) VALUES
	('1','1','1','6','0','Código','2',''),
	('2','1','2','50','0','Nome','1',''),
	('3','1','3','50','0','Endereço','1',''),
	('4','1','4','40','0','Bairro','1',''),
	('5','1','5','20','0','CNPJ','1','99.999.999/9999-99'),
	('6','1','6','20','0','CPF','1','999.999.999-99'),
	('7','1','7','20','0','IE','1',''),
	('8','1','8','20','0','RG','1',''),
	('9','1','9','50','0','Cidade','1',''),
	('10','1','10','2','0','Estado','1',''),
	('11','1','11','15','0','Fone','1','(99)-9999-9999'),
	('12','2','1','6','0','Código','2',''),
	('13','2','2','50','0','Nome','1',''),
	('14','3','1','15','0','Código','1',''),
	('15','3','2','50','0','Descrição','1',''),
	('16','3','3','10','0','Unidade','1',''),
	('17','3','4','2','0','Alíquota','2',''),
	('18','3','5','12','2','Preço de Venda','3','');
/*!40000 ALTER TABLE `pdv_arquivo_opcoes` ENABLE KEYS*/;
UNLOCK TABLES;

CREATE TABLE /*!32312 IF NOT EXISTS*/ `pdv_formato` (
  `id` int(4) unsigned NOT NULL auto_increment,
  `descricao` varchar(20) default NULL,
  PRIMARY KEY  (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `id_2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
LOCK TABLES `pdv_formato` WRITE;
/*!40000 ALTER TABLE `pdv_formato` DISABLE KEYS*/;
INSERT IGNORE INTO `pdv_formato` (`id`, `descricao`) VALUES
	('1','String (Texto)'),
	('2','Número Inteiro'),
	('3','Real Float (Decimal)'),
	('4','Data');
/*!40000 ALTER TABLE `pdv_formato` ENABLE KEYS*/;
UNLOCK TABLES;


-- Seeds adicionais
INSERT IGNORE INTO cad_login_perfil (id_perfil, nome_perfil, menu_options) VALUES (1, 'ADMINISTRADOR', REPEAT('S', 250));
INSERT IGNORE INTO cad_login (id, login, senha, id_perfil, inativo) VALUES (1, 'admin', '123456', 1, 0);
INSERT IGNORE INTO cad_moedas (id, moeda, cotacao) VALUES (1, 'BRL', 1.0000);
INSERT IGNORE INTO cad_produtos_tipo (id, nome_tipo) VALUES (1, 'PADRÃO');

SET FOREIGN_KEY_CHECKS=1;
