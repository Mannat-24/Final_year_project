let ioInstance;

export const setIo = (io) => {
  ioInstance = io;
};

export const getIo = () => {
  if (!ioInstance) {
    throw new Error("Socket.io has not been initialized");
  }
  return ioInstance;
};

export const emitSchoolEvent = (schoolId, eventName, payload) => {
  if (!ioInstance) return;
  ioInstance.to(`school:${schoolId}`).emit(eventName, payload);
};

export const emitStudentEvent = (studentId, eventName, payload) => {
  if (!ioInstance) return;
  ioInstance.to(`student:${studentId}`).emit(eventName, payload);
};

export const emitUserEvent = (userId, eventName, payload) => {
  if (!ioInstance) return;
  ioInstance.to(`user:${userId}`).emit(eventName, payload);
};