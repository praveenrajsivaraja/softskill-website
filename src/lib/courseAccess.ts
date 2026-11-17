export const canUsePurchasedCourseActions = ({
  isEnrolled,
  hasPaidOrder,
}: {
  isEnrolled: boolean;
  hasPaidOrder: boolean;
}) => isEnrolled || hasPaidOrder;
