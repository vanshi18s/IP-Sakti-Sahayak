import sys
import types
import pandas as pd
from datasets import Dataset

# 1. QUICK FIX FOR RAGAS BUG
# We mock the missing VertexAI module so Ragas can load without crashing
dummy_chat = types.ModuleType("langchain_community.chat_models.vertexai")
dummy_chat.ChatVertexAI = type("ChatVertexAI", (object,), {})
sys.modules["langchain_community.chat_models.vertexai"] = dummy_chat

# 2. NOW we can safely import Ragas
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy
from langchain_groq import ChatGroq

# 3. Setup your Groq LLM as the Judge
# Make sure your GROQ_API_KEY environment variable is set
# In PowerShell: $env:GROQ_API_KEY="gsk_5Dj..."
groq_llm = ChatGroq(model_name="llama3-8b-8192") # or "mixtral-8x7b-32768"

# 4. Your Test Data
questions = ["What is the main purpose of this system?"]
answers = ["The system is designed to help users file grievances."]
contexts = [["IP-Sakti-Sahayak is a portal to help users file grievances securely."]]

data = {
    "question": questions,
    "answer": answers,
    "contexts": contexts,
}
dataset = Dataset.from_dict(data)

# 5. Run the Evaluation using Groq
print("Evaluating with Ragas using Groq...")
eval_results = evaluate(
    dataset=dataset,
    metrics=[faithfulness, answer_relevancy],
    llm=groq_llm  # We explicitly tell Ragas to use Groq, not OpenAI
)

# 6. Save the results
df = eval_results.to_pandas()
print(df.head())
df.to_csv("evaluation_results.csv", index=False)
print("Saved to evaluation_results.csv")