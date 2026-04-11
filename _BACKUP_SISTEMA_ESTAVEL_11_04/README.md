# MetaRayx - Dashboard Admin 🚀

Sistema profissional de gestão e sincronização de vídeos para competições de redes sociais.

## ✨ Funcionalidades Principais

- **Dual-Key Parallel Sync**: Processamento ultrarrápido utilizando múltiplas APIs do Apify em paralelo.
- **Failover Automático**: Rotação inteligente de chaves API em caso de falha ou limite atingido.
- **Gestão de Competições**: Controle total de rankings, prêmios e regulamentos.
- **Auditoria Financeira**: Dashboard para auditoria de pagamentos e integridade de integridade de dados.
- **Visualização em Tempo Real**: Carimbos de progresso e feedback visual dinâmico durante as sessões de sincronização.

## 🛠️ Tecnologias

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Firebase (Firestore, Auth, Storage)
- **Data Scraping**: Apify SDK
- **Icons**: Lucide Icons
- **Motion**: Framer Motion

## 📦 Como rodar o projeto

1.  **Clone o repositório**
2.  **Instale as dependências**:
    ```bash
    npm install
    ```
3.  **Configure o Firebase**:
    - Crie um arquivo `.env` baseado nas configurações do console do Firebase.
4.  **Inicie o servidor de desenvolvimento**:
    ```bash
    npm run dev
    ```

## 🔒 Segurança

Os dados sensíveis (Chaves de API) são gerenciados via Firestore para administradores, nunca expostos no código fonte. Certifique-se de configurar as regras de segurança do Firebase corretamente.

---
Desenvolvido com foco em performance e integridade de dados.
