from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from openai import AsyncOpenAI
from app.core.config import settings

openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
utility_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.1, openai_api_key=settings.OPENAI_API_KEY)
tutor_llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.1, openai_api_key=settings.OPENAI_API_KEY)
embeddings = OpenAIEmbeddings(model="text-embedding-3-small", openai_api_key=settings.OPENAI_API_KEY)