from openai import OpenAI

# Initialize the client with your API key
client = OpenAI(
    api_key="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"
)

def chat_with_gpt(chat_log):
    response = client.chat.completions.create(
        model='gpt-3.5-turbo',
        messages=chat_log
    )
    return response.choices[0].message.content.strip()

chat_log = []
# Remembering more posts is more expensive
n_remembered_post = 2

if __name__ == "__main__":
    while True:
        user_input = input("You: ")
        if user_input.lower() in ['quit', "exit", "bye"]:
            break

        chat_log.append({'role': 'user', 'content': user_input})

        if len(chat_log) > n_remembered_post:
            del chat_log[:len(chat_log)-n_remembered_post]

        response = chat_with_gpt(chat_log)
        print("Chatbot:", response)
        chat_log.append({'role': "assistant", 'content': response})