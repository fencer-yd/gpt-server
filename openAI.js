const {createParser} = require('eventsource-parser')

class OpenAIError extends Error {

  constructor(message, type, param, code) {
    super(message);
    this.name = 'OpenAIError';
    this.type = type;
    this.param = param;
    this.code = code;
  }
}

const OpenAIStream = async (
  {
    model,
    systemPrompt,
    temperature,
    key,
    messages,
    host,
    ai_type,
    api_key,
    api_version,
    deploy_id,
    organization
  }
) => {
  let url = `${host}/v1/chat/completions`;
  if (ai_type === 'azure') {
    url = `${host}/openai/deployments/${deploy_id}/chat/completions?api-version=${api_version}`;
  }
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(ai_type === 'openai' && {
        Authorization: `Bearer ${key ? key : api_key}`,
      }),
      ...(ai_type === 'azure' && {
        'api-key': `${key ? key : api_key}`,
      }),
      ...(ai_type === 'openai' &&
        organization && {
          'OpenAI-Organization': organization,
        }),
    },
    method: 'POST',
    body: JSON.stringify({
      ...(ai_type === 'openai' && { model: model.id }),
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...messages,
      ],
      max_tokens: 1000,
      temperature: temperature,
      stream: true,
    }),
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  if (res.status !== 200) {
    const result = await res.json();
    if (result.error) {
      throw new OpenAIError(
        result.error.message,
        result.error.type,
        result.error.param,
        result.error.code,
      );
    } else {
      throw new Error(
        `OpenAI API returned an error: ${
          decoder.decode(result?.value) || result.statusText
        }`,
      );
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event) => {
        if (event.type === 'event') {
          const data = event.data;

          try {
            const json = JSON.parse(data);
            if (json.choices[0].finish_reason != null) {
              controller.close();
              return;
            }
            const text = json.choices[0].delta.content;
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      };

      const parser = createParser(onParse);

      for await (const chunk of res.body) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });

  return stream;
};

module.exports = {
  OpenAIStream,
  OpenAIError
}