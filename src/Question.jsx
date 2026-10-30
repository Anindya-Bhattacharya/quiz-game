function Question({ question, options, onAnswer }) {
  return (
    <div className="question">
      <h2>{question}</h2>

      <div className="options">
        {options.map((option, index) => (
          <button
            key={index}
            className="option-button"
            onClick={() => onAnswer(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export default Question;