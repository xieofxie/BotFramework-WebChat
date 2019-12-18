/* eslint no-magic-numbers: "off" */

export default function createSuggestedActionStyle({
  accent,
  paddingRegular,
  paddingWide,
  primaryFont,
  suggestedActionBackground,
  suggestedActionBorderColor,
  suggestedActionBorderStyle,
  suggestedActionBorderWidth,
  suggestedActionBorderRadius,
  suggestedActionImageHeight,
  suggestedActionTextColor,
  suggestedActionDisabledBackground,
  suggestedActionDisabledBorderColor,
  suggestedActionDisabledBorderStyle,
  suggestedActionDisabledBorderWidth,
  suggestedActionDisabledTextColor,
  suggestedActionHeight,
  subtle
}) {
  return {
    paddingBottom: paddingRegular / 2,
    paddingLeft: paddingRegular / 2,
    paddingRight: paddingRegular / 2,
    paddingTop: paddingRegular / 2,

    '& > button': {
      alignItems: 'center',
      borderRadius: suggestedActionBorderRadius,
      fontFamily: primaryFont,
      fontSize: 'inherit',
      height: suggestedActionHeight,
      justifyContent: 'center',
      paddingLeft: paddingWide,
      paddingRight: paddingWide,

      '&:disabled': {
        background: suggestedActionDisabledBackground || suggestedActionBackground,
        borderColor: suggestedActionDisabledBorderColor,
        borderStyle: suggestedActionDisabledBorderStyle,
        borderWidth: suggestedActionDisabledBorderWidth,
        color: suggestedActionDisabledTextColor || subtle
      },

      '&:not(:disabled)': {
        background: suggestedActionBackground,
        borderColor: suggestedActionBorderColor || accent,
        borderStyle: suggestedActionBorderStyle,
        borderWidth: suggestedActionBorderWidth,
        color: suggestedActionTextColor || accent
      },

      '& > img': {
        height: suggestedActionImageHeight,
        paddingRight: paddingRegular
      },

      '& > nobr': {
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }
  };
}
