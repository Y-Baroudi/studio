# **App Name**: Qur'an Meezan (ميزان القرآن)

## Vision and Purpose:

Qur'an Meezan is a dual-core application that seamlessly integrates a full-featured Quranic reader/player with a sophisticated AI-assisted conversational system, eliminating the need to switch between multiple apps while deepening one's engagement with the Qur'an and Islamic concepts.

## Core Architecture:

### Dual-Core Design:
- **Quranic Reader/Player** - Full-featured, independently usable component for reading and listening to the Qur'an
- **Conversational System** - Robust AI-assisted reflection platform modeled after Y's existing Claude setup
- **Unified Experience** - Seamless integration between both cores with shared context and easy navigation

### Foundation Elements:
- Firebase backend (authentication, Firestore, functions)
- API-first approach for Quranic content (alquran.cloud)
- Multi-model AI integration (Claude, Gemini, OpenAI)
- Universal reference system connecting Quranic content with conversations and concepts

## Core Features:

### Quranic Engagement:
- **Dual-Pane Reader**: Dual-pane display of Arabic text and English, translation fetched from alquran.cloud API
- **Audio Playback**: Audio playback with play/pause, verse navigation, reciter selection, and verse repetition fetched from alquran.cloud API
- **Eye-Comfort Mode**: Night mode toggle that syncs with system settings and provides a dark theme, along with font size adjustment
- **Verse Bookmarking**: Ability to bookmark verses for quick access

### AI Conversation System:
- **Thematic Organization**: Support for conversations organized around verses, topics, and concepts
- **AI Persona Configuration**: Preservation of detailed AI persona instructions (similar to Y's current Claude setup)
- **Model Flexibility**: Support for multiple AI models with seamless switching
- **Context Persistence**: Maintaining conversation context across sessions and model limitations
- **Note-Taking**: Native note-taking capabilities linked to verses and conversations

### Cross-Component Integration:
- **Universal Search**: Robust search across Quranic content, conversations, notes, and reference documents
- **Concept Tagging**: Ability to tag verses and conversations with personal conceptual frameworks (WIP, FoF, Divine Triangle)
- **Verse References**: Easy referencing of Quranic verses within conversations
- **Two-Way Navigation**: Seamless movement between reading a verse and discussing it

### Reference Document Management:
- **Tiered Document System**: Support for multiple document categories:
  1. Core concept documents (persistent, occasionally updated)
  2. General reference documents (medium-term)
  3. Conversation history (for context continuity)
- **Document Integration**: Ability to reference documents within conversations

## Style Guidelines:

- **Primary color**: Light beige (#F5F5DC) for a calm reading experience
- **Secondary color**: Soft green (#E8F5E9) to complement the primary color
- **Accent**: Teal (#008080) for interactive elements and highlights
- **Clean and simple layout** with clear separation of Arabic text and translation
- **Intuitive navigation** between reading and conversation modes
- **Subtle transitions** for a smooth user experience
- **Consistent visual language** across both core components

## Development Priorities:

1. **Foundation First**: 
   - Unified data schema design
   - Authentication and user profile
   - API service layer for Quranic content and AI models
   - Core UI navigation framework

2. **Dual-Core Implementation**:
   - Basic Quranic reader with API integration
   - Conversation interface with AI connection
   - Initial integration between components

3. **Cross-Cutting Capabilities**:
   - Universal search implementation
   - Reference system and concept tagging
   - Document management integration

4. **Progressive Enhancement**:
   - Additional Quranic reader features
   - Advanced conversation capabilities
   - Deeper integration between components

## Technical Approach:

- **Firebase Studio** as the primary development platform
- **React/Next.js** for frontend development
- **API-first** external data strategy
- **Model-agnostic** AI integration
- **Shared state management** across components
- **Offline capability** where feasible