import ReactMarkdown from 'react-markdown'

function isHTML(str) {
  return str && /<[a-z][\s\S]*>/i.test(str)
}

export function MarkdownContent({ children, className = '' }) {
  if (!children) return null
  if (isHTML(children)) {
    return (
      <div
        className={`prose-playbook ${className}`}
        dangerouslySetInnerHTML={{ __html: children }}
      />
    )
  }
  return (
    <div className={`prose-playbook ${className}`}>
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  )
}
