export default function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-4">⚠️</div>
      <h3 className="text-lg font-semibold text-white mb-2">오류가 발생했습니다</h3>
      <p className="text-gray-400 text-sm max-w-sm mb-4">
        {message || '데이터를 불러오는 중 문제가 발생했습니다.'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
        >
          다시 시도
        </button>
      )}
    </div>
  )
}
