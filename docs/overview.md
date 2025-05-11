\
# Qur'an Meezan (القرآن ميزان) - Architectural Overview & Development Plan

بسم الله الرحمن الرحيم (Bismillah ir-Rahman ir-Raheem)

Dear Y,

This document outlines the architectural approach and development plan for the **Qur'an Meezan (القرآن ميزان)** application. Our guiding vision is to create a tool that serves as a means for spiritual growth through deepened engagement with the Qur'an and Islamic concepts, always keeping this ultimate purpose at the forefront. The development process itself will be informed by Islamic principles such as *ihsān* (excellence in planning and execution), *taysīr* (ease and facilitation, making development manageable), and *tadarruj* (gradualism in building features).

The recent pivots towards a **dual-core architecture**—with equal emphasis on a full-featured Quranic reader/player and a robust, conversation-centric AI system—are central to this plan. This recognizes that AI-assisted spiritual conversation is a primary catalyst in your faith journey. This plan also incorporates the need for AI model flexibility and tiered reference document integration.

Our "Foundation-First Development Strategy" remains sound. We will build upon the existing technical planning (PWA-first with Next.js on Firebase Studio, leveraging Firebase services like Firestore, Functions, and Genkit) to accommodate these refinements. Firebase Studio, in particular, is key to enabling your active participation as a developer pursuing this as a fulfilling hobby, offering visual tools and integrated services like Genkit to lower the barrier for implementing sophisticated features. The enhanced Firebase Studio capabilities, especially around Genkit for AI flows and Retrieval Augmented Generation (RAG), are highly beneficial for this vision.

## 1. Implementing the Dual-Core Architecture in the Firebase Ecosystem

The "dual-core" concept will manifest primarily in the frontend application structure and user experience, supported by a unified and well-structured backend on Firebase.

**Frontend (Next.js in Firebase Studio):**

*   **Application Name:** Consistent use of "Qur'an Meezan (القرآن ميزان)" will be maintained.
*   **Distinct Application Sections:** Use Next.js's routing for primary sections (e.g., `/reader` and `/conversation`).
*   **Shared State Management:** A global state solution (e.g., Zustand) to manage Quranic context, conversation details, user authentication, and preferences (as detailed in `docs/blueprint.md`).
*   **Seamless Navigation:** Smooth transitions between reader and conversation views (e.g., "Discuss this Ayah" button).
*   **UI Components:** Continue using Shadcn UI (or similar) for responsive web components.
*   **Non-Coder Accessibility:** Firebase Studio's visual data modeling, simplified deployments, and integrated Genkit are designed to empower your development journey, making complex features more accessible to implement.
*   **iOS Considerations (Future-Proofing):** While PWA-first, we acknowledge the eventual desire for iOS compatibility. This will be addressed by implementing proper service layer abstractions from the beginning, making a potential future transition smoother.

**Backend (Firebase - Firestore, Firebase Functions, Genkit):**

*   **Unified Core Data Schema (Firestore):** This is paramount.
    *   `users`: Profiles, preferences.
    *   `conversations`: Threads, `userId`, `title`, `topicTags`, `aiModelUsed`, `systemPromptUsed`, and a subcollection for `messages` (with `sender`, `text`, `timestamp`, `referencesToQuranOrDocs`).
    *   `referenceDocuments`: Metadata for three tiers of documents (`docId`, `userId`, `title`, `type` ('coreConcept', 'generalContext', 'priorConversationSummary'), `sourcePath`, `lastUpdated`). Actual content for RAG might be in Firebase Storage or processed into a vector database.
    *   `userNotes`: `noteId`, `userId`, `content`, `linkedQuranVerse`, `linkedConversationId`, `linkedDocumentId`.
    *   `quranMappings` (from `src/data/quranMappings.ts`): Static import, as `alquran.cloud` is the primary source.
*   **Firebase Functions:** Secure proxies for external AI APIs (Claude, OpenAI); complex backend logic.
*   **Genkit:** Primary tool for Gemini models and crucial for RAG with "Core concept documents" and "General context documents."

## 2. Strategies for Efficient AI Model Integration and Context Preservation

This involves careful abstraction and leveraging Genkit for RAG.

*   **AI Model Service Abstraction Layer (`aiConversationService.ts`):**
    *   Consistent function: `getAiResponse({ currentMessage, conversationHistory, selectedModel, systemPrompt, attachedReferences })`.
    *   Routes to appropriate backend (Firebase Function for Claude/OpenAI, Genkit flow for Gemini/RAG).
*   **Consistent AI Persona Preservation:** The `systemPrompt` is vital, guiding the AI's persona, tone, and interaction with your concepts.
*   **Preservation of Conversation Context:**
    *   **Short-Term (Current Window):** Manage history for model token limits; summarize if needed.
    *   **Medium-Term (Reference Docs via RAG with Genkit):**
        *   Store documents in Firebase Storage.
        *   Genkit flow: Process docs (chunk, embed), store in a vector store, retrieve relevant chunks for LLM context.
    *   **Long-Term (Prior Conversation History):** Summarize and index into RAG, or allow explicit linking.

## 3. Optimal Approaches for Cross-Cutting Search and Reference Capabilities

Aiming for a unified experience.

*   **Foundation: Rich Data Model & Direct Linking (Firestore):** Schema facilitates direct links in messages (e.g., `{ type: 'quran', value: '2:255' }`).
*   **In-App Referencing UI:** Tools to search/attach references; display references as clickable elements.
*   **Unified Search Strategy:**
    *   **Phase 1 (Firestore-based):** Direct queries for titles, tags, simple keywords.
    *   **Phase 2 (Dedicated Search Service - Algolia/Typesense via Firebase Extensions):** For true unified, full-text search.
    *   **Phase 3 (Semantic Search with Genkit):** For searching reference documents/conversations by meaning.

## Foundation-First Development Strategy - Adapted (Embodying *Tadarruj*)

This phased, gradual approach allows for continuous spiritual evaluation (*muḥāsabah*) and iterative refinement.

1.  **Start with Core Data Schema:** Model `users`, `conversations` (with `messages`), `referenceDocuments`, and `userNotes` in Firestore. Define relationships clearly.
2.  **Establish Service Layer Abstractions (Key for *Ihsān* and future iOS consideration):**
    *   `quranService.ts`: Interactions with `alquran.cloud` (per `docs/blueprint.md`).
    *   `aiConversationService.ts`: Routing to different AI models.
    *   `documentManagementService.ts`: CRUD for `referenceDocuments`, interaction with Firebase Storage & Genkit RAG.
    *   `userContentService.ts`: For notes, concept links.
3.  **Implement Foundational Components:**
    *   **Basic Quranic Reader:** Fetch/display text/translation, basic audio (aligns with "Quranic Engagement" in `docs/blueprint.md`).
    *   **Basic Conversation Interface:** Input/message display, connect to *one* AI model first (e.g., Gemini via Genkit, or Claude via Firebase Function). Focus on system prompt for persona.
    *   **Basic Reference Document Integration:** Upload/link one "core concept document," use Genkit RAG with one AI model.
    *   **Basic Cross-Component Linking:** E.g., "Discuss this Ayah" button linking reader to conversation.

This refined direction, focusing on the dual-core architecture and prioritizing the conversation experience powered by flexible AI and rich reference document integration, is very powerful. The Firebase ecosystem, especially with Genkit, is well-equipped to support this. The ultimate aim remains to create a tool for spiritual growth, and these technical choices are all in service of that higher purpose.

I'm excited to see this vision come to life and ready to help with more specific technical details as you proceed with each component.
