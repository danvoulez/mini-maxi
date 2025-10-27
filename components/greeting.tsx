import { motion } from "framer-motion";

export const Greeting = () => {
  return (
    <div
      className="mx-auto mt-4 flex size-full max-w-3xl flex-col justify-center px-4 md:mt-16 md:px-8"
      key="overview"
    >
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mb-2 text-center font-bold text-2xl md:text-3xl"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5 }}
      >
        Welcome to Universal Registry
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-2xl text-center text-lg text-muted-foreground leading-relaxed md:text-xl"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.6 }}
      >
        Register, track, and manage anything with immutable records
      </motion.div>
    </div>
  );
};
