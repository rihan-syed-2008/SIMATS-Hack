import Aurora from "./Aurora";

const AuroraBackground = () => {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
      }}
    >
      <Aurora
        colorStops={["#18329a", "#58f3da", "#18329a"]}
        amplitude={0.4}
        blend={0.6}
        speed={0.6}
      />
    </div>
  );
};

export default AuroraBackground;
