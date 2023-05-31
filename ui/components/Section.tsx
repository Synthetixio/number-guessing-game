export default function Section({
  text,
  buttonText,
  onButtonClick,
  isLoading,
}: {
  text: string;
  buttonText: string;
  onButtonClick: () => void;
  isLoading: boolean;
}) {
  return (
    <section className="w-full m-2 p-2 flex flex-col items-center">
      <hr className="m-2 w-full" />
      {isLoading ? (
        <p>Transaction is Loading, please wait...</p>
      ) : (
        <>
          <p>{text}</p>
          <button
            className="border border-solid border-green-300 rounded p-2 bg-green-200 m-2"
            onClick={onButtonClick}
          >
            {buttonText}
          </button>
        </>
      )}
    </section>
  );
}
