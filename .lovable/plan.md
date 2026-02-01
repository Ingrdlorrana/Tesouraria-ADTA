
# Sistema de Tesouraria para Igreja

Sistema completo de gestão financeira para igreja com armazenamento no MongoDB Atlas (gratuito), acesso para pequena equipe de tesouraria.

---

## 🏠 Dashboard Principal
- **Resumo financeiro visual** com cards mostrando saldo atual, entradas e saídas do mês
- **Gráficos** de evolução mensal (linha) e distribuição por categoria (pizza)
- **Últimos lançamentos** com acesso rápido para edição
- **Indicadores** de comparação com mês anterior

---

## 📥 Módulo de Entradas
### Categorias configuradas:
- **Dízimos** - com identificação do membro
- **Ofertas** - gerais dos cultos
- **Doações** - com identificação do doador
- **Campanhas** - com nome da campanha
- **Almoço** - receita de eventos de alimentação

### Funcionalidades:
- Formulário de lançamento com data, valor, categoria e observações
- Lista de lançamentos com filtros por período e categoria
- Edição e exclusão de registros

---

## 📤 Módulo de Saídas
### Categorias configuradas:
- **Despesas fixas** - aluguel, luz, água, salários
- **Despesas variáveis** - manutenção, materiais
- **Repasses** - envios para sede/convenção
- **Ajudas sociais** - auxílios diversos

### Funcionalidades:
- Formulário com data, valor, categoria, beneficiário e comprovante
- Lista de despesas com filtros
- Controle de despesas fixas recorrentes

---

## 👥 Cadastro de Membros
- Lista de membros para associar aos dízimos
- Campos: nome, telefone, e-mail (opcionais)
- Histórico de contribuições por membro

---

## 📊 Relatórios

### Balancete Mensal
- Resumo de todas entradas por categoria
- Resumo de todas saídas por categoria
- Saldo inicial, movimentações e saldo final
- Opção de exportar para PDF

### Relatório de Dízimos
- Lista de dizimistas do período
- Valores individuais e total
- Identificação de membros regulares vs irregulares

### Fluxo de Caixa
- Visualização diária/semanal do saldo
- Gráfico de evolução
- Previsão baseada em despesas fixas

### Dashboard Visual
- Gráficos interativos de receitas vs despesas
- Comparativo mensal/anual
- Top categorias de entrada e saída

---

## 🔐 Acesso e Segurança
- **Login simples** com e-mail e senha para 2-3 usuários
- **Níveis de acesso**: Administrador (tudo) e Visualizador (apenas consultas)
- Registro de quem fez cada lançamento

---

## ⚙️ Configurações
- Cadastro de categorias personalizadas
- Dados da igreja (nome, CNPJ para relatórios)
- Gerenciamento de usuários

---

## 🔧 Tecnologias
- **Frontend**: React com interface moderna e responsiva
- **Banco de dados**: MongoDB Atlas (tier gratuito - 512MB)
- **Autenticação**: Sistema próprio com JWT
- **Relatórios**: Geração de PDF para impressão
