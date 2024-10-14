import express from "express";
import { CreateVaXendit, ReadAllVa, ReadVaById } from "../libs/xendit/VirtualAccountXendit";
import { CreateEWalletXendit } from "../libs/xendit/HandleEwalletXendit";
import { pr, SimulatePaymentMethod, SimulatePaymentRequest } from "../libs/xendit/xendit";
import env from "dotenv";
import { InvoiceModel } from "../models/model";
import { GenerateDate } from "../libs/HandleGenerate";
env.config();

const TransactionXenditControllers = express.Router();

const model = InvoiceModel;

// create
TransactionXenditControllers.post(`/transaction-create`, async (req, res) => {
  try {
    const data = await req.body;
    let create;

    switch (data.type) {
      case "va":
        create = await CreateVaXendit(data.channelCode, data.amount);
        break;

      case "ewallet":
        create = await CreateEWalletXendit(data.channelCode);

        const createRequest = await pr.createPaymentRequest({
          data: {
            currency: "IDR",
            amount: 100000,
            paymentMethodId: create.message.id,
            customerId: create.message.customerId,
            // referenceId: "e0bc317540017876e4ba437dc472a10e",
            // paymentMethod: {
            //   reusability: "MULTIPLE_USE",
            //   type: "EWALLET",
            //   ewallet: {
            //     channelCode: "SHOPEEPAY",
            //     channelProperties: {
            //       mobileNumber: "081217333000",
            //       successReturnUrl: "https://redirect.me/goodstuff",
            //       failureReturnUrl: "https://redirect.me/badstuff",
            //     },
            //   },
            // },
            // shippingInformation: {
            //   country: "ID",
            // },
            // initiator: "MERCHANT",
            // captureMethod: "AUTOMATIC",
          },
        });
        break;

      default:
        create = false;
        break;
    }

    if (!create.status) {
      return res.status(500).json({
        success: false,
        message: create.message,
      });
    }

    res.status(201).json({
      success: true,
      message: "berhasil",
      data: create,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// simulate payment
TransactionXenditControllers.post(`/transaction-payment/:id`, async (req, res) => {
  try {
    const { id } = await req.params;
    const { amount } = await req.body;
    const pay = await SimulatePaymentMethod(id, amount);

    if (!pay.success) {
      return res.status(500).json({
        success: false,
        message: pay.message,
      });
    }

    console.log(pay);

    res.status(201).json({
      success: true,
      message: "berhasil",
      data: pay,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// read payment methodd
TransactionXenditControllers.get(`/transaction-read/:uid?`, async (req, res) => {
  try {
    const { uid } = await req.params;
    var result;

    if (uid) {
      const find = await ReadVaById(uid);

      if (!find.status) {
        return res.status(404).json({
          success: false,
          message: "data tidak ditemukan",
        });
      }

      result = find.message;
    } else {
      const find = await ReadAllVa();

      if (!find.status) {
        return res.status(500).json({
          success: false,
          message: find.message,
        });
      }
      result = find.message.data;
    }

    res.status(200).json({
      success: true,
      message: "berhasil",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// read payment request
TransactionXenditControllers.get(`/transaction-request-read/:uid?`, async (req, res) => {
  try {
    const { uid } = await req.params;
    var result;

    if (uid) {
      const find = await pr.getPaymentRequestByID({
        paymentRequestId: uid,
      });

      if (!find.status) {
        return res.status(404).json({
          success: false,
          message: "data tidak ditemukan",
        });
      }

      result = find;
    } else {
      const find = await pr.getAllPaymentRequests();

      result = find;
    }

    res.status(200).json({
      success: true,
      message: "berhasil",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// update
TransactionXenditControllers.put(`/transaction-update`, async (req, res) => {
  try {
    const data = await req.body;

    const update = await model.update({
      where: {
        id: +data.id,
      },
      data: data,
    });

    res.status(200).json({
      success: true,
      message: "berhasil update",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// delete
TransactionXenditControllers.delete(`/transaction-delete/:id`, async (req, res) => {
  try {
    const { id } = await req.params;

    const hapus = await model.delete({
      where: {
        id: +id,
      },
    });

    res.status(200).json({
      success: true,
      message: "berhasil update",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// CALLBACK URL PAYMENT METHODS
TransactionXenditControllers.post("/xendit_callback_fva_create", async (req, res) => {
  try {
    const header = await req.headers;
    const callback_token = header["x-callback-token"];
    const data = await req.body;
    const date = await GenerateDate();

    const WEBHOOK_CALLBACK = "sjhKUaRs27cBB5rIFulcWzTedOi5RQufoHKiRgseeh82GFAw";

    if (callback_token === WEBHOOK_CALLBACK) {
      const create = await model.create({
        data: {
          status: "unpaid",
          amount: data.amount,
          description: description,
          currency: currency,
          created: date,
          updated: date,
        },
      });

      res.status(200).json({
        status: true,
        message: "berhasil",
        payload: data,
      });
    } else {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Access denied");
    }
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

// CALLBACK URL PAYMENT REQUESTS SUCCEED
TransactionXenditControllers.post("/xendit_callback_request_succeed", async (req, res) => {
  try {
    const header = await req.headers;
    const callback_token = header["x-callback-token"];
    const data = await req.body;
    const date = await GenerateDate();

    const WEBHOOK_CALLBACK = "sjhKUaRs27cBB5rIFulcWzTedOi5RQufoHKiRgseeh82GFAw";

    if (callback_token === WEBHOOK_CALLBACK) {
      // const create = await model.create({
      //   data: {
      //     status: "unpaid",
      //     amount: data.amount,
      //     description: description,
      //     currency: currency,
      //     created: date,
      //     updated: date,
      //   },
      // });

      res.status(200).json({
        status: true,
        message: "payment request succeed",
        payload: data,
      });
    } else {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Access denied");
    }
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

// CALLBACK URL PAYMENT REQUESTS FAILED
TransactionXenditControllers.post("/xendit_callback_request_failed", async (req, res) => {
  try {
    const header = await req.headers;
    const callback_token = header["x-callback-token"];
    const data = await req.body;
    const date = await GenerateDate();

    const WEBHOOK_CALLBACK = "sjhKUaRs27cBB5rIFulcWzTedOi5RQufoHKiRgseeh82GFAw";

    if (callback_token === WEBHOOK_CALLBACK) {
      // const create = await model.create({
      //   data: {
      //     status: "unpaid",
      //     amount: data.amount,
      //     description: description,
      //     currency: currency,
      //     created: date,
      //     updated: date,
      //   },
      // });

      res.status(200).json({
        status: true,
        message: "payment request failed",
        payload: data,
      });
    } else {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Access denied");
    }
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

// CALLBACK URL PAYMENT REQUESTS PENDING
TransactionXenditControllers.post("/xendit_callback_request_pending", async (req, res) => {
  try {
    const header = await req.headers;
    const callback_token = header["x-callback-token"];
    const data = await req.body;
    const date = await GenerateDate();

    const WEBHOOK_CALLBACK = "sjhKUaRs27cBB5rIFulcWzTedOi5RQufoHKiRgseeh82GFAw";

    if (callback_token === WEBHOOK_CALLBACK) {
      // const create = await model.create({
      //   data: {
      //     status: "unpaid",
      //     amount: data.amount,
      //     description: description,
      //     currency: currency,
      //     created: date,
      //     updated: date,
      //   },
      // });

      res.status(200).json({
        status: true,
        message: "payment request pending",
        payload: data,
      });
    } else {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Access denied");
    }
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

export default TransactionXenditControllers;
